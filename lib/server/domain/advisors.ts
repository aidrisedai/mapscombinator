import "server-only";
import { z } from "zod";
import { addDays, isIsoDate, programWeeks, todayIn, weekNumberFor } from "@/lib/time";
import { audit } from "../audit";
import { assertAdminWritable, requireCohortAdmin, requireCohortRead } from "../authz";
import { sql, tx, type Db } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import { invalid, notFound } from "../errors";
import type { Account } from "../session";
import { createInvitation } from "./invitations";
import { expertiseSchema, linkedinSchema } from "./mentors";
import { parse } from "./validate";
import { email as emailSchema, requiredText } from "@/lib/validation";
import { getOrganization } from "./organization";
import { publishedUpdatesFor } from "./updates";
import { getWeekForReader } from "./weeks";
import { forbidden } from "../errors";

const MAX_ROWS = 100;
const emailOk = (s: string) => z.email().safeParse(s).success && s.length <= 254;

export type AdvisorRow = { line: number; name: string; email: string; error?: string };

/**
 * Parse a pasted list: one advisor per line, as "Name, email", "Name <email>",
 * "Name email" or just "email". Tabs from spreadsheets work too.
 */
export function parseAdvisorList(textValue: string): AdvisorRow[] {
  const rows: AdvisorRow[] = [];
  const seen = new Set<string>();
  textValue.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = line.match(/[^\s<>,;"'()]+@[^\s<>,;"'()]+/);
    const email = (m?.[0] ?? "").toLowerCase().replace(/\.$/, "");
    const name = (m ? line.replace(m[0], "") : line).replace(/[<>()"]/g, " ").replace(/[,;\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    let error: string | undefined;
    if (!email || !emailOk(email)) error = "No valid email address on this line.";
    else if (seen.has(email)) error = "Listed twice.";
    if (email) seen.add(email);
    rows.push({ line: i + 1, name, email, error });
  });
  return rows;
}

export type AdvisorPlan = AdvisorRow & {
  action: "invite" | "add_existing" | "already" | "pending" | "skip";
  accountName?: string;
};

async function planRows(db: Db, actor: Account, cohortId: string, rows: AdvisorRow[]): Promise<AdvisorPlan[]> {
  const out: AdvisorPlan[] = [];
  for (const r of rows) {
    if (r.error) {
      out.push({ ...r, action: "skip" });
      continue;
    }
    const [acct] = await db`select id, display_name, state, organization_id from accounts where email = ${r.email}`;
    if (acct && acct.organization_id !== actor.organizationId) {
      out.push({ ...r, action: "skip", error: "This email belongs to another organization." });
      continue;
    }
    if (acct?.state === "suspended") {
      out.push({ ...r, action: "skip", error: "This account is suspended." });
      continue;
    }
    if (acct) {
      const [role] = await db`select 1 from cohort_roles where cohort_id = ${cohortId} and account_id = ${acct.id} and role = 'mentor' and active`;
      out.push({ ...r, action: role ? "already" : "add_existing", accountName: acct.display_name });
      continue;
    }
    const [inv] = await db`select 1 from invitations where email = ${r.email} and role = 'mentor' and cohort_id = ${cohortId}
                           and state in ('queued','sent','delivery_failed') and expires_at > now()`;
    out.push({ ...r, action: inv ? "pending" : "invite" });
  }
  return out;
}

/** What would happen for each pasted line. Sends nothing. */
export async function previewAdvisors(actor: Account, cohortId: string, list: string) {
  const a = await requireCohortAdmin(actor, cohortId);
  assertAdminWritable(a);
  const rows = parseAdvisorList(list);
  if (!rows.length) throw invalid("Paste at least one advisor: a name and email per line.");
  if (rows.length > MAX_ROWS) throw invalid(`Add up to ${MAX_ROWS} advisors at a time.`);
  return planRows(sql(), actor, cohortId, rows);
}

/** Give an existing account the advisor role here, without a new sign-up, and tell them by email. */
type Prefill = { expertise: string[]; linkedinUrl: string | null };

async function addExisting(actor: Account, cohortId: string, accountId: string, prefill?: Prefill) {
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [acct] = await t`select id, email, display_name from accounts where id = ${accountId} and organization_id = ${actor.organizationId} and state = 'active'`;
    if (!acct) throw notFound("That account isn't available.");
    const ins = await t`insert into cohort_roles (cohort_id, account_id, role, granted_by) values (${cohortId}, ${acct.id}, 'mentor', ${actor.id})
                        on conflict (cohort_id, account_id, role) where active do nothing returning id`;
    if (!ins[0]) return false;
    await t`insert into mentor_profiles (account_id) values (${acct.id}) on conflict do nothing`;
    // Fill only what the advisor hasn't set themselves.
    if (prefill?.expertise.length) await t`update mentor_profiles set expertise = ${prefill.expertise} where account_id = ${acct.id} and cardinality(expertise) = 0`;
    if (prefill?.linkedinUrl) await t`update mentor_profiles set linkedin_url = ${prefill.linkedinUrl} where account_id = ${acct.id} and linkedin_url is null`;
    const org = (await getOrganization(t, actor.organizationId))!;
    const support = a.cohort.supportEmail ?? org.supportEmail;
    await enqueueEmail(t, {
      eventType: "cohort_added",
      template: "cohort_added",
      to: acct.email,
      recipientAccountId: acct.id,
      cohortId,
      authorizedBy: actor.id,
      payload: { org: org.name, support, replyTo: support, cohort: a.cohort.name, inviter: actor.displayName, name: acct.display_name, url: `${env().APP_URL}/app/cohorts/${cohortId}/startups` },
      related: { type: "cohort_role", id: ins[0].id },
      idempotencyKey: `cohort_added:${ins[0].id}`,
    });
    await audit(t, { actorId: actor.id, action: "advisor.add_existing", objectType: "account", objectId: acct.id, cohortId });
    return true;
  });
}

/** Invite new advisors and add existing accounts directly. Re-running is safe: already-done rows are skipped. */
export async function addAdvisors(actor: Account, cohortId: string, list: string) {
  const plan = await previewAdvisors(actor, cohortId, list);
  let invited = 0;
  let added = 0;
  const problems: string[] = [];
  for (const p of plan) {
    try {
      if (p.action === "invite") {
        await createInvitation(actor, { role: "mentor", email: p.email, name: p.name || undefined, cohortId });
        invited++;
      } else if (p.action === "add_existing") {
        const [acct] = await sql()`select id from accounts where email = ${p.email}`;
        if (await addExisting(actor, cohortId, acct.id)) added++;
      }
    } catch (err) {
      problems.push(`${p.email}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  return { invited, added, skipped: plan.length - invited - added, problems };
}

/** Advisors from this organization's other cohorts who aren't in this one yet. */
export async function listOtherAdvisors(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`
    select a.id, a.display_name, a.email, p.headline, array_agg(distinct c.name order by c.name) as cohorts
    from cohort_roles r join accounts a on a.id = r.account_id and a.state = 'active' and a.organization_id = ${actor.organizationId}
    join cohorts c on c.id = r.cohort_id
    left join mentor_profiles p on p.account_id = a.id
    where r.role = 'mentor' and r.active and r.cohort_id <> ${cohortId}
      and not exists (select 1 from cohort_roles x where x.cohort_id = ${cohortId} and x.account_id = a.id and x.role = 'mentor' and x.active)
    group by a.id, a.display_name, a.email, p.headline order by a.display_name`;
}

export async function addExistingAdvisors(actor: Account, cohortId: string, accountIds: string[]) {
  const ids = [...new Set(accountIds)].filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (!ids.length) throw invalid("Choose at least one advisor.");
  let added = 0;
  for (const id of ids) if (await addExisting(actor, cohortId, id)) added++;
  return added;
}

/** Advisors in this cohort, with profile fields and appointment counts, for admins. */
export async function listCohortAdvisors(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`
    select r.id as role_id, r.created_at, a.id, a.display_name, a.email, a.state, p.headline, p.bio, p.expertise, p.linkedin_url,
      (select count(*)::int from mentor_availability_rules ar where ar.mentor_account_id = a.id and ar.state = 'active') as rules,
      (select count(*)::int from appointment_bookings b
        where b.mentor_account_id = a.id and b.cohort_id = ${cohortId} and b.state = 'confirmed' and b.starts_at > now()) as upcoming
    from cohort_roles r join accounts a on a.id = r.account_id
    left join mentor_profiles p on p.account_id = a.id
    where r.cohort_id = ${cohortId} and r.role = 'mentor' and r.active order by a.display_name`;
}

/**
 * Published-only progress per team for this week, for advisors, viewers and
 * admins. Drafts never count. Founders don't get the cross-team view.
 */
export type TeamProgressRow = {
  id: string;
  name: string;
  dailies: number;
  weekly: boolean;
  total: number;
  weekliesPosted: number;
  lastPublished: Date | null;
};

export async function teamProgress(actor: Account, cohortId: string) {
  const a = await requireCohortRead(actor, cohortId);
  if (!(a.isAdmin || a.isMentor || a.isViewer)) return null;
  const today = todayIn(a.cohort.timezone);
  const week = weekNumberFor(a.cohort.startDate, a.cohort.weekCount, today) ?? (today < a.cohort.startDate ? 1 : a.cohort.weekCount);
  const w = programWeeks(a.cohort.startDate, a.cohort.weekCount)[week - 1];
  const pub = sql()`u.enrollment_id = e.id and u.state = 'published' and u.hidden_at is null`;
  const rows = await sql()`
    select e.id, s.name,
      (select count(*)::int from team_updates u where ${pub} and u.kind = 'daily' and u.week_number = ${week}) as dailies,
      exists (select 1 from team_updates u where ${pub} and u.kind = 'weekly' and u.week_number = ${week}) as weekly,
      (select count(*)::int from team_updates u where ${pub} and u.kind = 'weekly' and u.week_number <= ${week}) as weeklies_posted,
      (select count(*)::int from team_updates u where ${pub}) as total,
      (select max(u.last_published_at) from team_updates u where ${pub}) as last_published
    from enrollments e join startups s on s.id = e.startup_id
    where e.cohort_id = ${cohortId} and e.status = 'active' order by s.name`;
  const teams: TeamProgressRow[] = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    dailies: r.dailies as number,
    weekly: r.weekly as boolean,
    total: r.total as number,
    weekliesPosted: r.weeklies_posted as number,
    lastPublished: (r.last_published as Date | null) ?? null,
  }));
  return { week, weekStart: w.startDate, weekEnd: w.endDate, timezone: a.cohort.timezone, teams, byTeam: new Map(teams.map((t) => [t.id, t])) };
}

/** A few advisors for a cohort's home page; everyone in the cohort can see them. */
export async function cohortAdvisorsPreview(actor: Account, cohortId: string, limit = 5) {
  await requireCohortRead(actor, cohortId);
  const rows = await sql()`
    select a.id, a.display_name, p.headline, count(*) over ()::int as total
    from cohort_roles r join accounts a on a.id = r.account_id and a.state = 'active'
    left join mentor_profiles p on p.account_id = a.id
    where r.cohort_id = ${cohortId} and r.role = 'mentor' and r.active order by a.display_name limit ${limit}`;
  return { advisors: rows.map((r) => ({ id: r.id as string, name: r.display_name as string, headline: (r.headline as string | null) || null })), total: (rows[0]?.total as number) ?? 0 };
}

// ───────────────────────────── Organization-wide advisors ──────────────────

/** Cohorts this person administers (owners: every cohort in the organization). */
export async function adminCohorts(actor: Account) {
  return actor.isOwner
    ? sql()`select id, name, status from cohorts where organization_id = ${actor.organizationId} order by start_date desc, name`
    : sql()`select c.id, c.name, c.status from cohorts c join cohort_roles r on r.cohort_id = c.id and r.role = 'admin' and r.active
            where r.account_id = ${actor.id} order by c.start_date desc, c.name`;
}

/** Every advisor in the cohorts this person manages, with the cohorts each one advises. */
export async function listAllAdvisors(actor: Account, cohortFilter?: string | null) {
  const cohorts = await adminCohorts(actor);
  if (!cohorts.length) throw forbidden("Only cohort administrators can manage advisors.");
  const ids = cohorts.map((c) => c.id as string);
  const filter = cohortFilter && ids.includes(cohortFilter) ? cohortFilter : null;
  const rows = await sql()`
    select a.id, a.display_name, a.email, a.state, p.headline, p.bio, p.expertise, p.linkedin_url, p.calendar_url,
      (select count(*)::int from mentor_availability_rules ar where ar.mentor_account_id = a.id and ar.state = 'active') as rules,
      jsonb_agg(jsonb_build_object('cohortId', c.id, 'cohortName', c.name, 'roleId', r.id, 'status', c.status) order by c.start_date desc) as cohorts
    from cohort_roles r join accounts a on a.id = r.account_id join cohorts c on c.id = r.cohort_id
    left join mentor_profiles p on p.account_id = a.id
    where r.role = 'mentor' and r.active and r.cohort_id = any(${ids})
      and (${filter}::uuid is null or exists (select 1 from cohort_roles f where f.account_id = a.id and f.cohort_id = ${filter} and f.role = 'mentor' and f.active))
    group by a.id, a.display_name, a.email, a.state, p.headline, p.bio, p.expertise, p.linkedin_url, p.calendar_url
    order by a.display_name`;
  const pending = await sql()`
    select i.id, i.email, i.invitee_name, i.role, i.state, i.delivery_state, i.created_at, i.expires_at, i.last_sent_at, i.send_count,
           i.accepted_at, i.enrollment_id, i.cohort_id, c.name as cohort_name,
           (select count(*)::int from invitation_help_requests h where h.invitation_id = i.id and h.handled_at is null) as help_requests,
           (select o.last_error from email_outbox o where o.related_type = 'invitation' and o.related_id = i.id order by o.created_at desc limit 1) as last_error,
           (select o.id from email_outbox o where o.related_type = 'invitation' and o.related_id = i.id and o.template = 'invitation' order by o.created_at desc limit 1) as latest_email_id
    from invitations i join cohorts c on c.id = i.cohort_id
    where i.role = 'mentor' and i.cohort_id = any(${ids}) and (${filter}::uuid is null or i.cohort_id = ${filter})
      and i.state not in ('accepted', 'revoked')
    order by i.created_at desc`;
  return { cohorts, filter, advisors: rows, pending };
}

const multiSchema = z.object({
  name: requiredText(120, "Name"),
  email: emailSchema,
  expertise: expertiseSchema,
  linkedinUrl: linkedinSchema,
  cohortIds: z.array(z.string().uuid()).min(1, "Choose at least one cohort."),
});

async function writableAdminCohorts(actor: Account, cohortIds: string[]) {
  const mine = await adminCohorts(actor);
  const ok = new Map(mine.filter((c) => c.status !== "archived").map((c) => [c.id as string, c.name as string]));
  for (const id of cohortIds) if (!ok.has(id)) throw forbidden("You can only add advisors to cohorts you manage (and that aren't archived).");
  return cohortIds.map((id) => ({ id, name: ok.get(id)! }));
}

/** What adding this person to these cohorts would do. Sends nothing. */
export async function previewAdvisorForCohorts(actor: Account, input: { name: string; email: string; expertise?: string; linkedinUrl?: string; cohortIds: string[] }) {
  const v = parse(multiSchema, input);
  const cohorts = await writableAdminCohorts(actor, v.cohortIds);
  const per = [];
  for (const c of cohorts) {
    const [plan] = await planRows(sql(), actor, c.id, [{ line: 1, name: v.name, email: v.email }]);
    per.push({ cohortId: c.id, cohortName: c.name, action: plan.action, error: plan.error, accountName: plan.accountName });
  }
  return { name: v.name, email: v.email, expertise: v.expertise, linkedinUrl: v.linkedinUrl, cohorts: per };
}

/**
 * Add one advisor to one or more cohorts. Existing accounts are added
 * directly; a new person gets a single invitation (for the first cohort) and
 * joins the other chosen cohorts when they accept.
 */
export async function addAdvisorToCohorts(actor: Account, input: { name: string; email: string; expertise?: string; linkedinUrl?: string; cohortIds: string[] }) {
  const p = await previewAdvisorForCohorts(actor, input);
  const prefill: Prefill = { expertise: p.expertise, linkedinUrl: p.linkedinUrl };
  const result = { invited: [] as string[], added: [] as string[], already: [] as string[], pending: [] as string[], willJoin: [] as string[] };
  const skip = p.cohorts.find((c) => c.action === "skip");
  if (skip) throw invalid(skip.error ?? "This person can't be added.");
  const [acct] = await sql()`select id from accounts where email = ${p.email}`;
  if (acct) {
    for (const c of p.cohorts) {
      if (c.action === "already") result.already.push(c.cohortName);
      else if (await addExisting(actor, c.cohortId, acct.id, prefill)) result.added.push(c.cohortName);
    }
    return result;
  }
  const todo = p.cohorts.filter((c) => c.action === "invite");
  for (const c of p.cohorts) if (c.action === "pending") result.pending.push(c.cohortName);
  if (!todo.length) return result;
  const [first, ...rest] = todo;
  const id = await createInvitation(actor, { role: "mentor", email: p.email, name: p.name, cohortId: first.cohortId });
  await sql()`update invitations set profile_prefill = ${sql().json({ ...prefill, extraCohortIds: rest.map((c) => c.cohortId) } as never)} where id = ${id}`;
  result.invited.push(first.cohortName);
  result.willJoin.push(...rest.map((c) => c.cohortName));
  return result;
}

// ───────────────────────────── One advisor (simple form) ───────────────────

const oneSchema = z.object({
  name: requiredText(120, "Name"),
  email: emailSchema,
  expertise: expertiseSchema,
  linkedinUrl: linkedinSchema,
});

/** What adding this one person would do. Sends nothing. */
export async function previewOneAdvisor(actor: Account, cohortId: string, input: Record<string, string>) {
  const v = parse(oneSchema, input);
  const a = await requireCohortAdmin(actor, cohortId);
  assertAdminWritable(a);
  const [plan] = await planRows(sql(), actor, cohortId, [{ line: 1, name: v.name, email: v.email }]);
  return { ...plan, expertise: v.expertise, linkedinUrl: v.linkedinUrl };
}

/** Invite a new advisor, or add an existing account straight away. Expertise and LinkedIn pre-fill their profile. */
export async function addOneAdvisor(actor: Account, cohortId: string, input: Record<string, string>) {
  const v = parse(oneSchema, input);
  const plan = await previewOneAdvisor(actor, cohortId, input);
  const prefill: Prefill = { expertise: v.expertise, linkedinUrl: v.linkedinUrl };
  if (plan.action === "skip") throw invalid(plan.error ?? "This person can't be added.");
  if (plan.action === "already") return { action: "already" as const, name: plan.accountName ?? v.name };
  if (plan.action === "pending") return { action: "pending" as const, name: v.name };
  if (plan.action === "add_existing") {
    const [acct] = await sql()`select id, display_name from accounts where email = ${v.email}`;
    await addExisting(actor, cohortId, acct.id, prefill);
    return { action: "added" as const, name: acct.display_name as string };
  }
  const id = await createInvitation(actor, { role: "mentor", email: v.email, name: v.name, cohortId });
  await sql()`update invitations set profile_prefill = ${sql().json(prefill as never)} where id = ${id}`;
  return { action: "invited" as const, name: v.name };
}

// ───────────────────────────── Advisor dashboard ───────────────────────────

/**
 * One cohort at a glance for advisors (and admins/viewers): every startup's
 * published daily update for a day, its weekly summary for the week, and the
 * week's guide and materials. Published content only, never drafts.
 */
export async function advisorDigest(actor: Account, cohortId: string, q: { week?: number; date?: string }) {
  const a = await requireCohortRead(actor, cohortId);
  if (!(a.isMentor || a.isAdmin || a.isViewer)) throw forbidden("This overview is for advisors and the program team.");
  const tz = a.cohort.timezone;
  const weeks = programWeeks(a.cohort.startDate, a.cohort.weekCount);
  const today = todayIn(tz);
  const current = weekNumberFor(a.cohort.startDate, a.cohort.weekCount, today) ?? (today < a.cohort.startDate ? 1 : a.cohort.weekCount);
  const week = q.week && q.week >= 1 && q.week <= weeks.length ? q.week : current;
  const range = weeks[week - 1];
  const days = Array.from({ length: 7 }, (_, i) => addDays(range.startDate, i));
  const date = q.date && isIsoDate(q.date) && days.includes(q.date) ? q.date : days.includes(today) ? today : range.startDate;
  const [startups, dailies, weeklies, counts, guide] = await Promise.all([
    sql()`select e.id, s.name from enrollments e join startups s on s.id = e.startup_id where e.cohort_id = ${cohortId} and e.status = 'active' order by s.name`,
    publishedUpdatesFor(cohortId, { kind: "daily", reportDate: date }),
    publishedUpdatesFor(cohortId, { kind: "weekly", week }),
    sql()`select enrollment_id,
            count(*) filter (where kind = 'daily' and week_number = ${week})::int as n,
            count(*) filter (where kind = 'weekly' and week_number <= ${week})::int as weeklies,
            max(last_published_at) as last_published
          from team_updates where cohort_id = ${cohortId} and state = 'published' and hidden_at is null group by enrollment_id`,
    getWeekForReader(actor, cohortId, week),
  ]);
  const dailyBy = new Map(dailies.map((u) => [u.enrollmentId, u]));
  const weeklyBy = new Map(weeklies.map((u) => [u.enrollmentId, u]));
  const countBy = new Map(counts.map((c) => [c.enrollment_id as string, c]));
  return {
    access: a,
    week,
    currentWeek: current,
    weekCount: weeks.length,
    range,
    days,
    date,
    today,
    guide: { content: guide.content, resources: guide.resources },
    teams: startups.map((s) => ({
      id: s.id as string,
      name: s.name as string,
      daily: dailyBy.get(s.id as string) ?? null,
      weekly: weeklyBy.get(s.id as string) ?? null,
      dailiesThisWeek: (countBy.get(s.id as string)?.n as number) ?? 0,
      weekliesPosted: (countBy.get(s.id as string)?.weeklies as number) ?? 0,
      lastPublished: (countBy.get(s.id as string)?.last_published as Date | null) ?? null,
    })),
  };
}
