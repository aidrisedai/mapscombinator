import "server-only";
import { z } from "zod";
import { programWeeks, todayIn, weekNumberFor } from "@/lib/time";
import { audit } from "../audit";
import { assertAdminWritable, requireCohortAdmin, requireCohortRead } from "../authz";
import { sql, tx, type Db } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import { invalid, notFound } from "../errors";
import type { Account } from "../session";
import { createInvitation } from "./invitations";
import { getOrganization } from "./organization";

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
async function addExisting(actor: Account, cohortId: string, accountId: string) {
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [acct] = await t`select id, email, display_name from accounts where id = ${accountId} and organization_id = ${actor.organizationId} and state = 'active'`;
    if (!acct) throw notFound("That account isn't available.");
    const ins = await t`insert into cohort_roles (cohort_id, account_id, role, granted_by) values (${cohortId}, ${acct.id}, 'mentor', ${actor.id})
                        on conflict (cohort_id, account_id, role) where active do nothing returning id`;
    if (!ins[0]) return false;
    await t`insert into mentor_profiles (account_id) values (${acct.id}) on conflict do nothing`;
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
export async function teamProgress(actor: Account, cohortId: string) {
  const a = await requireCohortRead(actor, cohortId);
  if (!(a.isAdmin || a.isMentor || a.isViewer)) return null;
  const today = todayIn(a.cohort.timezone);
  const week = weekNumberFor(a.cohort.startDate, a.cohort.weekCount, today) ?? (today < a.cohort.startDate ? 1 : a.cohort.weekCount);
  const w = programWeeks(a.cohort.startDate, a.cohort.weekCount)[week - 1];
  const rows = await sql()`
    select e.id as enrollment_id,
      (select count(*)::int from team_updates u where u.enrollment_id = e.id and u.kind = 'daily' and u.week_number = ${week} and u.state = 'published' and u.hidden_at is null) as dailies,
      exists (select 1 from team_updates u where u.enrollment_id = e.id and u.kind = 'weekly' and u.week_number = ${week} and u.state = 'published' and u.hidden_at is null) as weekly,
      (select count(*)::int from team_updates u where u.enrollment_id = e.id and u.state = 'published' and u.hidden_at is null) as total
    from enrollments e where e.cohort_id = ${cohortId} and e.status = 'active'`;
  return { week, weekStart: w.startDate, weekEnd: w.endDate, byTeam: new Map(rows.map((r) => [r.enrollment_id as string, r as unknown as { dailies: number; weekly: boolean; total: number }])) };
}
