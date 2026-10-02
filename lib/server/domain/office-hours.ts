import "server-only";
import { z } from "zod";
import { addDays, formatTimeRange, isIsoDate, isLocalTime, localDateOf, localTimeOf, resolveLocal, weekNumberFor } from "@/lib/time";
import { optionalHttps, requiredText, text } from "@/lib/validation";
import { audit } from "../audit";
import { assertAdminWritable, requireCohortAdmin, requireCohortRead, type CohortAccess } from "../authz";
import { sql, tx, type Tx } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import { conflict, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { getOrganization } from "./organization";
import { cohortRecipients } from "./recipients";
import { parse } from "./validate";

const detailsSchema = z.object({
  title: requiredText(160, "Title"),
  hostName: text(120, "Host").default(""),
  hostAccountId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || null),
  mode: z.enum(["online", "in_person", "hybrid"]),
  meetingUrl: optionalHttps,
  location: text(300, "Location").default(""),
  description: text(4000, "Description").default(""),
  preparation: text(2000, "Preparation").default(""),
  weekNumber: z.coerce.number().int().min(0).max(52).optional().default(0),
});

const timingSchema = z.object({
  date: z.string().refine(isIsoDate, "Choose a date."),
  startTime: z.string().refine(isLocalTime, "Choose a start time."),
  durationMinutes: z.coerce.number().int().min(5, "At least 5 minutes.").max(480, "At most 8 hours."),
  repeatWeekly: z.enum(["on", "off", ""]).optional().transform((v) => v === "on"),
  occurrences: z.coerce.number().int().min(1).max(52).optional().default(1),
});

export type Occurrence = { position: number; localDate: string; startsAt: Date | null; endsAt: Date | null; error: string | null };

/** Materialize occurrences on local wall-clock time; DST gaps/overlaps are surfaced, not shifted. */
export function planOccurrences(a: CohortAccess, t: z.infer<typeof timingSchema>): Occurrence[] {
  const count = t.repeatWeekly ? t.occurrences : 1;
  const tz = a.cohort.timezone;
  const lastProgramDay = addDays(a.cohort.startDate, a.cohort.weekCount * 7 - 1);
  return Array.from({ length: count }, (_, i) => {
    const localDate = addDays(t.date, i * 7);
    const r = resolveLocal(localDate, t.startTime, tz);
    let error: string | null = null;
    let startsAt: Date | null = null;
    if (r.kind === "nonexistent") error = "This time doesn't exist on this date (clocks spring forward).";
    else if (r.kind === "ambiguous") error = "This time occurs twice on this date (clocks fall back). Choose another time.";
    else startsAt = r.utc;
    if (!error && localDate > lastProgramDay) error = "After the cohort's last program day.";
    if (!error && startsAt && startsAt < new Date()) error = "This time has already passed.";
    return { position: i + 1, localDate, startsAt, endsAt: startsAt ? new Date(startsAt.getTime() + t.durationMinutes * 60_000) : null, error };
  });
}

async function validateHost(t: Tx, cohortId: string, hostAccountId: string | null) {
  if (!hostAccountId) return null;
  const [h] = await t`select a.display_name from cohort_roles r join accounts a on a.id = r.account_id
                      where r.cohort_id = ${cohortId} and r.account_id = ${hostAccountId} and r.active and r.role in ('admin', 'mentor')`;
  if (!h) throw invalid("The host must be a mentor or administrator of this cohort.", { hostAccountId: "Not a member of this cohort." });
  return h.display_name as string;
}

async function weekIdFor(t: Tx, cohortId: string, n: number) {
  if (!n) return null;
  const [w] = await t`select id from program_weeks where cohort_id = ${cohortId} and number = ${n}`;
  if (!w) throw invalid("That week isn't part of this cohort.");
  return w.id as string;
}

/** A published session hosted by a mentor blocks their individual availability. */
async function assertHostFree(t: Tx, hostAccountId: string | null, startsAt: Date, endsAt: Date, ignoreSessionId?: string) {
  if (!hostAccountId) return;
  await t`select pg_advisory_xact_lock(hashtext(${"mentor:" + hostAccountId}))`;
  const [b] = await t`select id from appointment_bookings where mentor_account_id = ${hostAccountId} and state = 'confirmed'
                      and tstzrange(blocked_start, blocked_end) && tstzrange(${startsAt}, ${endsAt})`;
  if (b) throw conflict("The host has a confirmed mentor appointment during this time. Pick another time or resolve that appointment first.");
  const [s] = await t`select id from office_hours_sessions where host_account_id = ${hostAccountId} and state = 'published'
                      and id <> ${ignoreSessionId ?? "00000000-0000-0000-0000-000000000000"}
                      and tstzrange(starts_at, ends_at) && tstzrange(${startsAt}, ${endsAt})`;
  if (s) throw conflict("The host already has a published session during this time.");
}

export function previewSessions(a: CohortAccess, input: Record<string, string>) {
  const t = parse(timingSchema, input);
  return planOccurrences(a, t).map((o) => ({ ...o, label: o.startsAt ? formatTimeRange(o.startsAt, o.endsAt!, a.cohort.timezone) : o.localDate }));
}

async function snapshot(t: Tx, sessionId: string, actorId: string) {
  const [s] = await t`select * from office_hours_sessions where id = ${sessionId}`;
  await t`insert into office_hours_session_revisions (session_id, revision, snapshot, actor_id) values (${sessionId}, ${s.revision}, ${t.json(s as never)}, ${actorId})`;
}

/** Create one session or a weekly series (separate occurrences), as drafts. */
export async function createSessions(actor: Account, cohortId: string, input: Record<string, string>) {
  const d = parse(detailsSchema, input);
  const timing = parse(timingSchema, input);
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    if (d.mode !== "in_person" && !d.meetingUrl) throw invalid("Add the meeting link for online sessions.", { meetingUrl: "Required for online/hybrid." });
    if (d.mode !== "online" && !d.location) throw invalid("Add a location for in-person sessions.", { location: "Required for in-person/hybrid." });
    const hostName = (await validateHost(t, cohortId, d.hostAccountId)) ?? d.hostName;
    const occ = planOccurrences(a, timing);
    const bad = occ.find((o) => o.error);
    if (bad) throw invalid(`Occurrence ${bad.position} (${bad.localDate}): ${bad.error}`);
    let seriesId: string | null = null;
    if (occ.length > 1) {
      const [s] = await t`insert into office_hours_series (cohort_id, first_local_date, local_start_time, duration_minutes, timezone, occurrence_count, created_by)
                          values (${cohortId}, ${timing.date}, ${timing.startTime}, ${timing.durationMinutes}, ${a.cohort.timezone}, ${occ.length}, ${actor.id}) returning id`;
      seriesId = s.id;
    }
    const ids: string[] = [];
    for (const o of occ) {
      const wk = d.weekNumber || weekNumberFor(a.cohort.startDate, a.cohort.weekCount, o.localDate) || 0;
      const weekId = await weekIdFor(t, cohortId, wk);
      const [row] = await t`
        insert into office_hours_sessions (cohort_id, week_id, series_id, series_position, title, host_name, host_account_id, starts_at, ends_at,
          timezone, mode, meeting_url, location, description, preparation, created_by, updated_by)
        values (${cohortId}, ${weekId}, ${seriesId}, ${seriesId ? o.position : null}, ${d.title}, ${hostName}, ${d.hostAccountId}, ${o.startsAt}, ${o.endsAt},
          ${a.cohort.timezone}, ${d.mode}, ${d.meetingUrl}, ${d.location || null}, ${d.description}, ${d.preparation}, ${actor.id}, ${actor.id})
        returning id`;
      ids.push(row.id);
    }
    await audit(t, { actorId: actor.id, action: "session.create", objectType: "office_hours_session", objectId: ids[0], cohortId, summary: { count: ids.length, series: seriesId } });
    return { ids, seriesId };
  });
}

function sessionEmailPayload(s: Record<string, unknown>, a: CohortAccess, org: { name: string; supportEmail: string | null }, extra: Record<string, string | null> = {}) {
  const where = [s.mode !== "in_person" ? (s.meeting_url as string) : null, s.mode !== "online" ? (s.location as string) : null].filter(Boolean).join(" · ");
  return {
    org: org.name,
    support: a.cohort.supportEmail ?? org.supportEmail,
    replyTo: a.cohort.supportEmail ?? org.supportEmail,
    cohort: a.cohort.name,
    title: s.title as string,
    host: (s.host_name as string) || null,
    when: formatTimeRange(s.starts_at as Date, s.ends_at as Date, s.timezone as string),
    where: where || null,
    preparation: (s.preparation as string) || null,
    url: `${env().APP_URL}/app/cohorts/${a.cohort.id}/office-hours/${s.id}`,
    ...extra,
  };
}

async function notifySession(t: Tx, actor: Account, a: CohortAccess, sessionIds: string[], template: "session_published" | "session_changed" | "session_cancelled", extra: (s: Record<string, unknown>) => Record<string, string | null> = () => ({})) {
  const org = (await getOrganization(t, actor.organizationId))!;
  const recipients = await cohortRecipients(t, a.cohort.id);
  let queued = 0;
  for (const id of sessionIds) {
    const [s] = await t`select * from office_hours_sessions where id = ${id}`;
    for (const r of recipients) {
      const ok = await enqueueEmail(t, {
        eventType: template,
        template,
        to: r.email,
        recipientAccountId: r.id,
        cohortId: a.cohort.id,
        authorizedBy: actor.id,
        payload: sessionEmailPayload(s, a, org, extra(s)),
        related: { type: "office_hours_session", id },
        idempotencyKey: `${template}:${id}:r${s.revision}:${r.id}`,
      });
      if (ok) queued++;
    }
    await t`update office_hours_sessions set last_notified_at = now() where id = ${id}`;
  }
  return queued;
}

/** Publish one draft, or every draft occurrence in its series. */
export async function publishSessions(actor: Account, cohortId: string, sessionId: string, opts: { wholeSeries: boolean; sendEmail: boolean }) {
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [s] = await t`select * from office_hours_sessions where id = ${sessionId} and cohort_id = ${cohortId} for update`;
    if (!s) throw notFound();
    const targets = opts.wholeSeries && s.series_id
      ? await t`select * from office_hours_sessions where series_id = ${s.series_id} and state = 'draft' and starts_at > now() order by starts_at for update`
      : s.state === "draft" ? [s] : [];
    if (!targets.length) throw conflict("There's nothing left to publish.");
    for (const x of targets) {
      await assertHostFree(t, x.host_account_id, x.starts_at, x.ends_at, x.id);
      await t`update office_hours_sessions set state = 'published', published_at = now(), updated_at = now(), updated_by = ${actor.id} where id = ${x.id}`;
      await snapshot(t, x.id, actor.id);
    }
    await audit(t, { actorId: actor.id, action: "session.publish", objectType: "office_hours_session", objectId: sessionId, cohortId, summary: { count: targets.length, email: opts.sendEmail } });
    const queued = opts.sendEmail ? await notifySession(t, actor, a, targets.map((x) => x.id as string), "session_published") : 0;
    return { published: targets.length, queued };
  });
}

/**
 * Edit this occurrence, or this and future occurrences of the series. Past
 * occurrences are never modified. Time edits keep each occurrence's own date.
 */
export async function updateSession(actor: Account, cohortId: string, sessionId: string, input: Record<string, string>, opts: { scope: "this" | "future"; sendEmail: boolean }) {
  const d = parse(detailsSchema, input);
  const timing = parse(timingSchema.pick({ date: true, startTime: true, durationMinutes: true }), input);
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [s] = await t`select * from office_hours_sessions where id = ${sessionId} and cohort_id = ${cohortId} for update`;
    if (!s) throw notFound();
    if (s.state === "cancelled") throw conflict("This session was cancelled and can't be edited.");
    if (new Date(s.ends_at) < new Date()) throw conflict("Past sessions can't be changed.");
    if (d.mode !== "in_person" && !d.meetingUrl) throw invalid("Add the meeting link for online sessions.", { meetingUrl: "Required for online/hybrid." });
    if (d.mode !== "online" && !d.location) throw invalid("Add a location for in-person sessions.", { location: "Required for in-person/hybrid." });
    const hostName = (await validateHost(t, cohortId, d.hostAccountId)) ?? d.hostName;
    const targets =
      opts.scope === "future" && s.series_id
        ? await t`select * from office_hours_sessions where series_id = ${s.series_id} and starts_at >= ${s.starts_at} and state <> 'cancelled' order by starts_at for update`
        : [s];
    const dayShift = Math.round((Date.parse(timing.date) - Date.parse(localDateOf(s.starts_at, s.timezone))) / 86400_000);
    const changedIds: string[] = [];
    const previous = new Map<string, string>();
    for (const x of targets) {
      const localDate = addDays(localDateOf(x.starts_at, x.timezone), dayShift);
      const r = resolveLocal(localDate, timing.startTime, x.timezone);
      if (r.kind !== "ok") throw invalid(`${localDate}: that time doesn't exist or is ambiguous because of a clock change.`);
      const startsAt = r.utc;
      const endsAt = new Date(startsAt.getTime() + timing.durationMinutes * 60_000);
      if (startsAt < new Date()) throw invalid("The new time has already passed.");
      if (x.state === "published") await assertHostFree(t, d.hostAccountId, startsAt, endsAt, x.id);
      const timeChanged = startsAt.getTime() !== new Date(x.starts_at).getTime() || endsAt.getTime() !== new Date(x.ends_at).getTime();
      if (timeChanged) previous.set(x.id, formatTimeRange(x.starts_at, x.ends_at, x.timezone));
      const weekId = await weekIdFor(t, cohortId, d.weekNumber || weekNumberFor(a.cohort.startDate, a.cohort.weekCount, localDate) || 0);
      await t`update office_hours_sessions set title = ${d.title}, host_name = ${hostName}, host_account_id = ${d.hostAccountId},
              mode = ${d.mode}, meeting_url = ${d.meetingUrl}, location = ${d.location || null}, description = ${d.description},
              preparation = ${d.preparation}, starts_at = ${startsAt}, ends_at = ${endsAt}, week_id = ${weekId},
              revision = revision + 1, updated_at = now(), updated_by = ${actor.id}
              where id = ${x.id}`;
      await snapshot(t, x.id, actor.id);
      changedIds.push(x.id);
    }
    await audit(t, { actorId: actor.id, action: "session.update", objectType: "office_hours_session", objectId: sessionId, cohortId, summary: { scope: opts.scope, count: changedIds.length } });
    const publishedIds = targets.filter((x) => x.state === "published").map((x) => x.id as string);
    const queued = opts.sendEmail && publishedIds.length ? await notifySession(t, actor, a, publishedIds, "session_changed", (x) => ({ previous: previous.get(x.id as string) ?? null })) : 0;
    return { changed: changedIds.length, queued };
  });
}

export async function cancelSession(actor: Account, cohortId: string, sessionId: string, opts: { scope: "this" | "future"; reason: string; sendEmail: boolean }) {
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [s] = await t`select * from office_hours_sessions where id = ${sessionId} and cohort_id = ${cohortId} for update`;
    if (!s) throw notFound();
    const targets =
      opts.scope === "future" && s.series_id
        ? await t`select * from office_hours_sessions where series_id = ${s.series_id} and starts_at >= ${s.starts_at} and state <> 'cancelled' and starts_at > now() for update`
        : s.state !== "cancelled" && new Date(s.starts_at) > new Date() ? [s] : [];
    if (!targets.length) throw conflict("There's nothing upcoming to cancel.");
    const reason = opts.reason.trim().slice(0, 500) || null;
    const wasPublished = targets.filter((x) => x.state === "published").map((x) => x.id as string);
    for (const x of targets) {
      // Drafts that were never published simply become cancelled (not visible to founders).
      await t`update office_hours_sessions set state = 'cancelled', cancel_reason = ${reason}, revision = revision + 1, updated_at = now(), updated_by = ${actor.id} where id = ${x.id}`;
      await snapshot(t, x.id, actor.id);
    }
    await audit(t, { actorId: actor.id, action: "session.cancel", objectType: "office_hours_session", objectId: sessionId, cohortId, summary: { scope: opts.scope, count: targets.length, reason } });
    const queued = opts.sendEmail && wasPublished.length ? await notifySession(t, actor, a, wasPublished, "session_cancelled", () => ({ reason })) : 0;
    return { cancelled: targets.length, queued };
  });
}

/** Readers: published + cancelled-after-publish. Admins: everything. */
export async function listSessions(actor: Account, cohortId: string, opts: { when: "upcoming" | "past"; weekId?: string; limit?: number }) {
  const a = await requireCohortRead(actor, cohortId);
  const upcoming = opts.when === "upcoming";
  const rows = await sql()`
    select s.*, (select count(*)::int from office_hours_sessions x where x.series_id = s.series_id) as series_count
    from office_hours_sessions s
    where s.cohort_id = ${cohortId}
      and (${a.isAdmin} or s.state = 'published' or (s.state = 'cancelled' and s.published_at is not null))
      and (${opts.weekId ?? null}::uuid is null or s.week_id = ${opts.weekId ?? null})
      and (case when ${upcoming} then s.ends_at >= now() else s.ends_at < now() end)
    order by case when ${upcoming} then s.starts_at end asc, case when not ${upcoming} then s.starts_at end desc
    limit ${opts.limit ?? 100}`;
  return { access: a, sessions: rows };
}

export async function getSession(actor: Account, cohortId: string, sessionId: string) {
  const a = await requireCohortRead(actor, cohortId);
  const [s] = await sql()`select * from office_hours_sessions where id = ${sessionId} and cohort_id = ${cohortId}`;
  if (!s || (!a.isAdmin && s.state === "draft") || (!a.isAdmin && s.state === "cancelled" && !s.published_at)) throw notFound();
  const history = a.isAdmin
    ? await sql()`select r.revision, r.created_at, r.snapshot->>'state' as state, a.display_name as actor from office_hours_session_revisions r
                  join accounts a on a.id = r.actor_id where r.session_id = ${sessionId} order by r.revision desc`
    : [];
  return { access: a, session: s, history, localDate: localDateOf(s.starts_at, s.timezone), localTime: localTimeOf(s.starts_at, s.timezone) };
}

/** Every occurrence of a series (admin view, for series-wide actions). */
export async function listSeriesOccurrences(actor: Account, cohortId: string, seriesId: string) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`select id, series_position, starts_at, ends_at, timezone, state, title from office_hours_sessions
               where series_id = ${seriesId} and cohort_id = ${cohortId} order by starts_at`;
}

/** Cohort mentors and administrators who can host a session. */
export async function sessionHostOptions(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`select a.id, a.display_name, array_agg(distinct r.role) as roles from cohort_roles r
               join accounts a on a.id = r.account_id and a.state = 'active'
               where r.cohort_id = ${cohortId} and r.active and r.role in ('admin', 'mentor')
               group by a.id, a.display_name order by a.display_name`;
}

/** Outbox counts for one session's notifications, by template and delivery state. */
export async function sessionEmailCounts(actor: Account, cohortId: string, sessionId: string) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`select template, state, count(*)::int as n from email_outbox
               where related_type = 'office_hours_session' and related_id = ${sessionId} and cohort_id = ${cohortId}
               group by template, state order by template, state`;
}
