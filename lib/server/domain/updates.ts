import "server-only";
import { z } from "zod";
import { addDays, isIsoDate, todayIn, weekNumberFor } from "@/lib/time";
import { optionalHttps, text } from "@/lib/validation";
import { audit } from "../audit";
import { assertFounderWritable, canSeeTeamPrivate, requireCohortAdmin, requireCohortRead, requireFounderOf, type CohortAccess } from "../authz";
import { pgCode, sql, tx } from "../db";
import { AppError, forbidden, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { parse } from "./validate";

export type UpdateKind = "daily" | "weekly";

export const LIMITS = {
  daily: { moved: 1200, next: 1200, blockers: 1500 },
  weekly: { accomplished: 4000, learned: 4000, nextCommitments: 4000, blockers: 1500 },
} as const;

const dailyShape = z.object({
  moved: text(LIMITS.daily.moved, "What moved forward").default(""),
  next: text(LIMITS.daily.next, "What's next").default(""),
  blockers: text(LIMITS.daily.blockers, "Blockers").default(""),
  link: optionalHttps,
});
const weeklyShape = z.object({
  accomplished: text(LIMITS.weekly.accomplished, "Accomplishments").default(""),
  learned: text(LIMITS.weekly.learned, "Learning").default(""),
  nextCommitments: text(LIMITS.weekly.nextCommitments, "Next week's commitments").default(""),
  blockers: text(LIMITS.weekly.blockers, "Blockers").default(""),
  link: optionalHttps,
});
const REQUIRED: Record<UpdateKind, [string, string][]> = {
  daily: [["moved", "Say what moved forward today."], ["next", "Say what's next."]],
  weekly: [["accomplished", "Describe what the team accomplished."], ["learned", "Describe what the team learned."], ["nextCommitments", "List next week's commitments."]],
};

export type SaveInput = {
  enrollmentId: string;
  kind: UpdateKind;
  reportDate?: string; // daily
  weekNumber?: number; // weekly
  content: Record<string, string>;
  /** Version the editor loaded; null when the editor started from "absent". */
  lockVersion: number | null;
  intent: "draft" | "publish";
};

export type SaveResult = { id: string; lockVersion: number; state: "draft" | "published"; savedAt: string; revision: number };

/** Thrown when a teammate saved first. Carries the current server copy; the editor keeps local text. */
export class UpdateConflict extends AppError {
  constructor(public current: { id: string; lockVersion: number; state: string; content: Record<string, string>; editor: string; updatedAt: string }) {
    super("conflict", "A teammate saved this update after you opened it. Your text is still here — compare and choose what to keep.");
  }
}

function resolvePeriod(a: CohortAccess, input: SaveInput) {
  const c = a.cohort;
  const today = todayIn(c.timezone);
  if (input.kind === "daily") {
    if (!input.reportDate || !isIsoDate(input.reportDate)) throw invalid("Choose a reporting date.", { reportDate: "Choose a date." });
    if (input.reportDate > today) throw invalid("Daily updates can't be dated in the future.", { reportDate: "Future dates aren't allowed." });
    const week = weekNumberFor(c.startDate, c.weekCount, input.reportDate);
    if (!week) throw invalid("That date is outside the program dates.", { reportDate: "Outside the program dates." });
    return { reportDate: input.reportDate, weekNumber: week };
  }
  const n = Number(input.weekNumber);
  if (!Number.isInteger(n) || n < 1 || n > c.weekCount) throw invalid("Choose a program week.", { weekNumber: "Choose a week." });
  if (addDays(c.startDate, (n - 1) * 7) > today) throw invalid("That week hasn't started yet.", { weekNumber: "This week hasn't started." });
  return { reportDate: null, weekNumber: n };
}

function sameContent(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? null) !== (b[k] ?? null)) return false;
  return true;
}

/**
 * Save a team update (draft or publish). One record per enrollment + kind +
 * period (DB-enforced); optimistic lock prevents silent overwrites; revision
 * creation and the write commit together.
 */
export async function saveUpdate(actor: Account, cohortId: string, input: SaveInput): Promise<SaveResult> {
  const { access } = await requireFounderOf(actor, cohortId, input.enrollmentId);
  assertFounderWritable(access);
  const period = resolvePeriod(access, input);
  const content = parse(input.kind === "daily" ? dailyShape : weeklyShape, input.content) as Record<string, string | null>;

  return tx(async (t) => {
    const [existing] =
      input.kind === "daily"
        ? await t`select * from team_updates where enrollment_id = ${input.enrollmentId} and kind = 'daily' and report_date = ${period.reportDate} for update`
        : await t`select * from team_updates where enrollment_id = ${input.enrollmentId} and kind = 'weekly' and week_number = ${period.weekNumber} for update`;

    const publishing = input.intent === "publish" || existing?.state === "published";
    if (publishing) {
      const missing: Record<string, string> = {};
      for (const [k, msg] of REQUIRED[input.kind]) if (!content[k]) missing[k] = msg;
      if (Object.keys(missing).length) throw invalid("Fill in the required fields to publish. Your text is still here.", missing);
    }

    if (existing) {
      if (input.lockVersion !== existing.lock_version) {
        // Idempotent retry / double-click: identical content and state is success.
        if (sameContent(existing.content, content) && (existing.state === "published" || input.intent === "draft")) {
          return { id: existing.id, lockVersion: existing.lock_version, state: existing.state, savedAt: new Date(existing.updated_at).toISOString(), revision: existing.current_revision };
        }
        const [editor] = await t`select display_name from accounts where id = ${existing.last_editor_id}`;
        throw new UpdateConflict({
          id: existing.id,
          lockVersion: existing.lock_version,
          state: existing.state,
          content: existing.content,
          editor: editor?.display_name ?? "A teammate",
          updatedAt: new Date(existing.updated_at).toISOString(),
        });
      }
      const wasPublished = existing.state === "published";
      const newState = publishing ? "published" : "draft";
      const revision = existing.current_revision + 1;
      const [u] = await t`
        update team_updates set content = ${t.json(content as never)}, state = ${newState}, lock_version = lock_version + 1,
          current_revision = ${revision}, last_editor_id = ${actor.id}, updated_at = now(),
          first_published_at = case when ${newState} = 'published' then coalesce(first_published_at, now()) else first_published_at end,
          last_published_at = case when ${newState} = 'published' then now() else last_published_at end,
          edited_after_publish = edited_after_publish or ${wasPublished}
        where id = ${existing.id} returning *`;
      await t`insert into update_revisions (update_id, revision, state, content, author_id) values (${u.id}, ${revision}, ${newState}, ${t.json(content as never)}, ${actor.id})`;
      if (newState === "published" && !wasPublished)
        await audit(t, { actorId: actor.id, action: "update.publish", objectType: "team_update", objectId: u.id, cohortId });
      return { id: u.id, lockVersion: u.lock_version, state: u.state, savedAt: new Date(u.updated_at).toISOString(), revision };
    }

    if (input.lockVersion !== null) throw notFound("This update no longer exists. Your text is still here; save again to recreate it.");
    const state = publishing ? "published" : "draft";
    try {
      const [u] = await t`
        insert into team_updates (cohort_id, enrollment_id, kind, report_date, week_number, state, content, current_revision,
          created_by, last_editor_id, first_published_at, last_published_at)
        values (${cohortId}, ${input.enrollmentId}, ${input.kind}, ${period.reportDate}, ${period.weekNumber}, ${state},
          ${t.json(content as never)}, 1, ${actor.id}, ${actor.id},
          ${state === "published" ? t`now()` : null}, ${state === "published" ? t`now()` : null})
        returning *`;
      await t`insert into update_revisions (update_id, revision, state, content, author_id) values (${u.id}, 1, ${state}, ${t.json(content as never)}, ${actor.id})`;
      if (state === "published") await audit(t, { actorId: actor.id, action: "update.publish", objectType: "team_update", objectId: u.id, cohortId });
      return { id: u.id, lockVersion: u.lock_version, state: u.state, savedAt: new Date(u.updated_at).toISOString(), revision: 1 };
    } catch (err) {
      // A teammate created the same record concurrently.
      if (pgCode(err) === "23505") throw new AppError("conflict", "A teammate just started this update. Reload to open their version — your text is still here.");
      throw err;
    }
  });
}

export type UpdateRow = {
  id: string;
  enrollmentId: string;
  startupName: string;
  kind: UpdateKind;
  reportDate: string | null;
  weekNumber: number;
  state: "draft" | "published";
  content: Record<string, string | null>;
  lockVersion: number;
  firstPublishedAt: string | null;
  lastPublishedAt: string | null;
  editedAfterPublish: boolean;
  updatedAt: string;
  createdBy: string;
  lastEditor: string;
  hidden: { at: string; reason: string } | null;
};

function mapUpdate(r: Record<string, unknown>): UpdateRow {
  return {
    id: r.id as string,
    enrollmentId: r.enrollment_id as string,
    startupName: r.startup_name as string,
    kind: r.kind as UpdateKind,
    reportDate: (r.report_date as string) ?? null,
    weekNumber: r.week_number as number,
    state: r.state as UpdateRow["state"],
    content: r.content as Record<string, string | null>,
    lockVersion: r.lock_version as number,
    firstPublishedAt: r.first_published_at ? new Date(r.first_published_at as string).toISOString() : null,
    lastPublishedAt: r.last_published_at ? new Date(r.last_published_at as string).toISOString() : null,
    editedAfterPublish: r.edited_after_publish as boolean,
    updatedAt: new Date(r.updated_at as string).toISOString(),
    createdBy: r.created_by_name as string,
    lastEditor: r.last_editor_name as string,
    hidden: r.hidden_at ? { at: new Date(r.hidden_at as string).toISOString(), reason: r.hidden_reason as string } : null,
  };
}

const SELECT = (db: ReturnType<typeof sql>) => db`
  select u.*, s.name as startup_name, ca.display_name as created_by_name, le.display_name as last_editor_name
  from team_updates u
  join enrollments e on e.id = u.enrollment_id
  join startups s on s.id = e.startup_id
  join accounts ca on ca.id = u.created_by
  join accounts le on le.id = u.last_editor_id`;

/** Load the record for the composer (team members only). */
export async function getUpdateForPeriod(actor: Account, cohortId: string, enrollmentId: string, kind: UpdateKind, period: { reportDate?: string; weekNumber?: number }) {
  await requireFounderOf(actor, cohortId, enrollmentId);
  const db = sql();
  const rows =
    kind === "daily"
      ? await db`${SELECT(db)} where u.enrollment_id = ${enrollmentId} and u.cohort_id = ${cohortId} and u.kind = 'daily' and u.report_date = ${period.reportDate ?? null}`
      : await db`${SELECT(db)} where u.enrollment_id = ${enrollmentId} and u.cohort_id = ${cohortId} and u.kind = 'weekly' and u.week_number = ${period.weekNumber ?? null}`;
  return rows[0] ? mapUpdate(rows[0]) : null;
}

export type JournalFilter = { kind?: UpdateKind | "all"; enrollmentId?: string; week?: number; page?: number };
export const PAGE_SIZE = 20;

/**
 * Cohort journal: published, unhidden updates only — enforced in SQL. Drafts
 * are returned separately and only for the viewer's own team(s).
 */
export async function listJournal(actor: Account, cohortId: string, f: JournalFilter) {
  const a = await requireCohortRead(actor, cohortId);
  const db = sql();
  const page = Math.max(1, Math.min(1000, f.page ?? 1));
  const kind = f.kind && f.kind !== "all" ? f.kind : null;
  const week = f.week && Number.isInteger(f.week) ? f.week : null;
  const enrollment = f.enrollmentId && /^[0-9a-f-]{36}$/i.test(f.enrollmentId) ? f.enrollmentId : null;
  const rows = await db`
    ${SELECT(db)}
    where u.cohort_id = ${cohortId} and u.state = 'published' and u.hidden_at is null
      and (${kind}::text is null or u.kind = ${kind})
      and (${week}::int is null or u.week_number = ${week})
      and (${enrollment}::uuid is null or u.enrollment_id = ${enrollment})
    order by u.last_published_at desc, u.id
    limit ${PAGE_SIZE + 1} offset ${(page - 1) * PAGE_SIZE}`;
  const ownTeams = a.founderOf.map((x) => x.enrollmentId);
  const drafts = ownTeams.length
    ? await db`${SELECT(db)} where u.cohort_id = ${cohortId} and u.state = 'draft' and u.enrollment_id = any(${ownTeams})
               and (${enrollment}::uuid is null or u.enrollment_id = ${enrollment})
               order by u.updated_at desc limit 20`
    : [];
  return { access: a, items: rows.slice(0, PAGE_SIZE).map(mapUpdate), hasMore: rows.length > PAGE_SIZE, page, drafts: drafts.map(mapUpdate) };
}

/** A startup's timeline. Drafts and hidden posts only for team/admin. */
export async function listTeamTimeline(actor: Account, cohortId: string, enrollmentId: string, f: { kind?: UpdateKind | "all"; week?: number; page?: number }) {
  const a = await requireCohortRead(actor, cohortId);
  const priv = canSeeTeamPrivate(a, enrollmentId);
  const db = sql();
  const page = Math.max(1, f.page ?? 1);
  const kind = f.kind && f.kind !== "all" ? f.kind : null;
  const week = f.week ?? null;
  const rows = await db`
    ${SELECT(db)}
    where u.cohort_id = ${cohortId} and u.enrollment_id = ${enrollmentId}
      and (${priv} or (u.state = 'published' and u.hidden_at is null))
      and (${kind}::text is null or u.kind = ${kind})
      and (${week}::int is null or u.week_number = ${week})
    order by coalesce(u.report_date, (select w.end_date from program_weeks w where w.cohort_id = u.cohort_id and w.number = u.week_number)) desc,
             u.kind desc, u.updated_at desc
    limit ${PAGE_SIZE + 1} offset ${(page - 1) * PAGE_SIZE}`;
  return { access: a, canSeePrivate: priv, items: rows.slice(0, PAGE_SIZE).map(mapUpdate), hasMore: rows.length > PAGE_SIZE, page };
}

/** The team's daily notes for one program week (weekly-summary reference). */
export async function dailyNotesForWeek(actor: Account, cohortId: string, enrollmentId: string, weekNumber: number) {
  await requireFounderOf(actor, cohortId, enrollmentId);
  const db = sql();
  const rows = await db`${SELECT(db)} where u.cohort_id = ${cohortId} and u.enrollment_id = ${enrollmentId} and u.kind = 'daily' and u.week_number = ${weekNumber}
                        order by u.report_date`;
  return rows.map(mapUpdate);
}

/** Previous week's "next commitments", shown as reference in the weekly composer. */
export async function previousCommitments(actor: Account, cohortId: string, enrollmentId: string, weekNumber: number) {
  await requireFounderOf(actor, cohortId, enrollmentId);
  const [r] = await sql()`select content->>'nextCommitments' as c, state from team_updates
    where enrollment_id = ${enrollmentId} and cohort_id = ${cohortId} and kind = 'weekly' and week_number = ${weekNumber - 1}`;
  return r?.c ? { text: r.c as string, state: r.state as string } : null;
}

export async function getUpdate(actor: Account, cohortId: string, updateId: string) {
  const a = await requireCohortRead(actor, cohortId);
  const db = sql();
  const [r] = await db`${SELECT(db)} where u.id = ${updateId} and u.cohort_id = ${cohortId}`;
  if (!r) throw notFound();
  const priv = canSeeTeamPrivate(a, r.enrollment_id);
  if (!priv && (r.state !== "published" || r.hidden_at)) throw notFound();
  return { access: a, update: mapUpdate(r), canSeePrivate: priv };
}

export async function listRevisions(actor: Account, cohortId: string, updateId: string) {
  const { canSeePrivate } = await getUpdate(actor, cohortId, updateId);
  if (!canSeePrivate) throw forbidden("Revision history is available to the team and administrators.");
  return sql()`select r.revision, r.state, r.content, r.created_at, a.display_name as author
               from update_revisions r join accounts a on a.id = r.author_id where r.update_id = ${updateId} order by r.revision desc`;
}

/** Admin moderation: hides/unhides with a reason. Never edits founder text. */
export async function moderateUpdate(actor: Account, cohortId: string, updateId: string, hide: boolean, reason: string) {
  await tx(async (t) => {
    await requireCohortAdmin(actor, cohortId, t);
    if (hide && !reason.trim()) throw invalid("Give a reason for hiding this post.", { reason: "Required." });
    const rows = hide
      ? await t`update team_updates set hidden_at = now(), hidden_by = ${actor.id}, hidden_reason = ${reason.trim().slice(0, 500)} where id = ${updateId} and cohort_id = ${cohortId} and state = 'published' returning id`
      : await t`update team_updates set hidden_at = null, hidden_by = null, hidden_reason = null where id = ${updateId} and cohort_id = ${cohortId} returning id`;
    if (!rows[0]) throw notFound();
    await audit(t, { actorId: actor.id, action: hide ? "update.hide" : "update.unhide", objectType: "team_update", objectId: updateId, cohortId, summary: { reason } });
  });
}

/** Admin participation overview: posted / not yet — never a score. */
export async function participation(actor: Account, cohortId: string, date: string, week: number) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`
    select e.id as enrollment_id, s.name,
      exists (select 1 from team_updates u where u.enrollment_id = e.id and u.kind = 'daily' and u.report_date = ${date} and u.state = 'published') as daily_today,
      exists (select 1 from team_updates u where u.enrollment_id = e.id and u.kind = 'daily' and u.report_date = ${date} and u.state = 'draft') as daily_draft,
      (select count(*)::int from team_updates u where u.enrollment_id = e.id and u.kind = 'daily' and u.week_number = ${week} and u.state = 'published') as dailies_this_week,
      exists (select 1 from team_updates u where u.enrollment_id = e.id and u.kind = 'weekly' and u.week_number = ${week} and u.state = 'published') as weekly_done,
      (select max(u.last_published_at) from team_updates u where u.enrollment_id = e.id and u.state = 'published') as last_published
    from enrollments e join startups s on s.id = e.startup_id
    where e.cohort_id = ${cohortId} and e.status = 'active' order by s.name`;
}
