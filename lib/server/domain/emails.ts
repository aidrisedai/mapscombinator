import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { formatDate, programWeeks, todayIn, weekNumberFor } from "@/lib/time";
import { requiredText } from "@/lib/validation";
import { audit } from "../audit";
import { assertAdminWritable, requireCohortAdmin, type CohortAccess } from "../authz";
import { sql, tx, type Db, type Tx } from "../db";
import { AUTO_EMAILS, AUTO_KINDS, type AutoKind } from "../email/defaults";
import { firstName, merge, unknownPlaceholders, type MergeVars } from "../email/merge";
import { enqueueEmail } from "../email/outbox";
import { render } from "../email/templates";
import { env } from "../env";
import { invalid, notFound } from "../errors";
import type { Account } from "../session";
import { getOrganization } from "./organization";
import { parse } from "./validate";

const MAX_RECIPIENTS = 1000;

const contentSchema = z
  .object({
    subject: z.string().transform((v) => v.replace(/[\r\n]+/g, " ")).pipe(requiredText(200, "Subject")),
    body: z.string().transform((v) => v.replace(/\r\n?/g, "\n")).pipe(requiredText(10000, "Message")),
  })
  .superRefine((v, ctx) => {
    for (const f of ["subject", "body"] as const) {
      const bad = unknownPlaceholders(v[f]);
      if (bad.length) ctx.addIssue({ code: "custom", path: [f], message: `Unknown placeholder${bad.length > 1 ? "s" : ""}: ${bad.map((b) => `{${b}}`).join(", ")}. Use one from the list.` });
    }
  });

const isAutoKind = (k: string): k is AutoKind => (AUTO_KINDS as string[]).includes(k);

// ───────────────────────────── Automatic emails ────────────────────────────

/** The cohort's custom wording for an automatic email, or the built-in default. */
export async function autoTemplate(db: Db, cohortId: string | null, kind: AutoKind) {
  if (cohortId) {
    const [t] = await db`select subject, body from email_templates where cohort_id = ${cohortId} and kind = ${kind}`;
    if (t) return { subject: t.subject as string, body: t.body as string, custom: true };
  }
  return { subject: AUTO_EMAILS[kind].subject, body: AUTO_EMAILS[kind].body, custom: false };
}

async function baseVars(db: Db, cohortId: string, orgId: string): Promise<MergeVars & { support: string | null; org: string }> {
  const [c] = await db`select name, start_date, support_email from cohorts where id = ${cohortId}`;
  const org = (await getOrganization(db, orgId))!;
  const support = (c?.support_email as string | null) ?? org.supportEmail;
  return { cohort_name: c?.name, start_date: c ? formatDate(c.start_date) : "", program_name: org.name, support_email: support ?? "", support, org: org.name };
}

/** Subject/body for a founder or mentor invitation, merged for this person. Other roles keep the standard invitation. */
export async function invitationCopy(db: Db, i: { role: string; cohortId: string | null; organizationId: string; name: string | null; startup: string | null; inviter: string }) {
  const kind: AutoKind | null = i.role === "founder" ? "acceptance" : i.role === "mentor" ? "mentor_invitation" : null;
  if (!kind || !i.cohortId) return {};
  const t = await autoTemplate(db, i.cohortId, kind);
  const vars: MergeVars = { ...(await baseVars(db, i.cohortId, i.organizationId)), first_name: firstName(i.name), full_name: i.name ?? "", startup_name: i.startup ?? "", inviter_name: i.inviter };
  return { customSubject: merge(t.subject, vars), customBody: merge(t.body, vars) };
}

/** Queue the welcome email after someone accepts a founder or mentor invitation (inside the acceptance transaction). */
export async function queueWelcome(t: Tx, inv: Record<string, unknown>, accountId: string) {
  const role = inv.role as string;
  if ((role !== "founder" && role !== "mentor") || !inv.cohort_id) return;
  const cohortId = inv.cohort_id as string;
  const kind: AutoKind = role === "founder" ? "founder_welcome" : "mentor_welcome";
  const [acct] = await t`select email, display_name, organization_id from accounts where id = ${accountId}`;
  const [st] = inv.enrollment_id ? await t`select s.name from enrollments e join startups s on s.id = e.startup_id where e.id = ${inv.enrollment_id as string}` : [];
  const [inviter] = inv.invited_by ? await t`select display_name from accounts where id = ${inv.invited_by as string}` : [];
  const base = await baseVars(t, cohortId, acct.organization_id);
  const vars: MergeVars = { ...base, first_name: firstName(acct.display_name), full_name: acct.display_name, startup_name: st?.name ?? "", inviter_name: inviter?.display_name ?? base.org };
  const tpl = await autoTemplate(t, cohortId, kind);
  const app = env().APP_URL;
  await enqueueEmail(t, {
    eventType: "welcome",
    template: "custom",
    to: acct.email,
    recipientAccountId: accountId,
    cohortId,
    payload: {
      org: base.org,
      support: base.support,
      replyTo: base.support,
      subject: merge(tpl.subject, vars),
      body: merge(tpl.body, vars),
      buttonLabel: role === "founder" ? "Open the platform" : "Open your profile",
      url: role === "founder" ? `${app}/app/cohorts/${cohortId}${inv.enrollment_id ? `?team=${inv.enrollment_id}` : ""}` : `${app}/mentor/profile`,
    },
    related: { type: "invitation", id: inv.id as string },
    idempotencyKey: `welcome:${inv.id}`,
  });
}

export async function listAutoTemplates(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  const db = sql();
  const out = [];
  for (const kind of AUTO_KINDS) out.push({ kind, ...AUTO_EMAILS[kind], current: await autoTemplate(db, cohortId, kind) });
  return out;
}

export async function saveAutoTemplate(actor: Account, cohortId: string, kind: string, input: Record<string, string>) {
  if (!isAutoKind(kind)) throw notFound();
  const v = parse(contentSchema, input);
  await tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    await t`insert into email_templates (cohort_id, kind, subject, body, updated_by) values (${cohortId}, ${kind}, ${v.subject}, ${v.body}, ${actor.id})
            on conflict (cohort_id, kind) where kind <> 'saved' do update set subject = excluded.subject, body = excluded.body, updated_by = excluded.updated_by, updated_at = now()`;
    await audit(t, { actorId: actor.id, action: "email_template.save", objectType: "cohort", objectId: cohortId, cohortId, summary: { kind } });
  });
}

export async function resetAutoTemplate(actor: Account, cohortId: string, kind: string) {
  if (!isAutoKind(kind)) throw notFound();
  await tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    await t`delete from email_templates where cohort_id = ${cohortId} and kind = ${kind}`;
    await audit(t, { actorId: actor.id, action: "email_template.reset", objectType: "cohort", objectId: cohortId, cohortId, summary: { kind } });
  });
}

/** Example recipient for previews: the first startup's contact, or a mentor. */
async function sampleVars(db: Db, a: CohortAccess, actor: Account, mentor: boolean, enrollmentId?: string) {
  const base = await baseVars(db, a.cohort.id, actor.organizationId);
  if (mentor) {
    const [m] = await db`select a.display_name from cohort_roles r join accounts a on a.id = r.account_id where r.cohort_id = ${a.cohort.id} and r.role = 'mentor' and r.active order by a.display_name limit 1`;
    const name = (m?.display_name as string) ?? "Sam Advisor";
    return { ...base, first_name: firstName(name), full_name: name, startup_name: "", inviter_name: actor.displayName };
  }
  const [e] = enrollmentId
    ? await db`select e.contact_name, s.name from enrollments e join startups s on s.id = e.startup_id where e.id = ${enrollmentId} and e.cohort_id = ${a.cohort.id}`
    : await db`select e.contact_name, s.name from enrollments e join startups s on s.id = e.startup_id where e.cohort_id = ${a.cohort.id} and e.status = 'active' order by s.name limit 1`;
  const name = (e?.contact_name as string) ?? "Alex Founder";
  return { ...base, first_name: firstName(name), full_name: name, startup_name: (e?.name as string) ?? "Example Startup", inviter_name: actor.displayName };
}

function renderAuto(kind: AutoKind, subject: string, body: string, vars: Awaited<ReturnType<typeof sampleVars>>, email: string, link: string) {
  const common = { org: vars.org, support: vars.support };
  if (kind === "acceptance" || kind === "mentor_invitation")
    return render("invitation", { ...common, email, expires: "in 7 days", customSubject: merge(subject, vars), customBody: merge(body, vars) }, { link });
  return render("custom", { ...common, subject: merge(subject, vars), body: merge(body, vars), buttonLabel: kind === "founder_welcome" ? "Open the platform" : "Open your profile", url: link });
}

/** Rendered example of an automatic email with unsaved edits. Sends nothing. */
export async function previewAutoTemplate(actor: Account, cohortId: string, kind: string, input: Record<string, string>) {
  if (!isAutoKind(kind)) throw notFound();
  const v = parse(contentSchema, input);
  const a = await requireCohortAdmin(actor, cohortId);
  const vars = await sampleVars(sql(), a, actor, kind.startsWith("mentor"));
  const r = renderAuto(kind, v.subject, v.body, vars, "the person you invite", `${env().APP_URL}/accept-invitation#example`);
  return { subject: r.subject, html: r.html, sample: vars.full_name };
}

/** Send the current draft of an automatic email to yourself. */
export async function sendAutoTemplateTest(actor: Account, cohortId: string, kind: string, input: Record<string, string>) {
  if (!isAutoKind(kind)) throw notFound();
  const v = parse(contentSchema, input);
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    const vars = await sampleVars(t, a, actor, kind.startsWith("mentor"));
    const isInvite = kind === "acceptance" || kind === "mentor_invitation";
    await enqueueEmail(t, {
      eventType: "test",
      template: "custom",
      to: actor.email,
      recipientAccountId: actor.id,
      cohortId,
      authorizedBy: actor.id,
      payload: {
        org: vars.org,
        support: vars.support,
        replyTo: vars.support,
        subject: `[Test] ${merge(v.subject, vars)}`,
        body: merge(v.body, vars),
        buttonLabel: isInvite ? "Set up your account" : kind === "founder_welcome" ? "Open the platform" : "Open your profile",
        url: `${env().APP_URL}/sign-in`,
        small: `Test copy filled in with ${vars.full_name}'s details. In real ${isInvite ? "invitations the button sets up the person's account and the email says when it expires" : "emails the button opens the platform"}.`,
      },
      idempotencyKey: `test:${randomUUID()}`,
    });
    return actor.email;
  });
}

// ───────────────────────────── Saved templates ─────────────────────────────

export async function listSavedTemplates(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`select id, name, subject, body, updated_at from email_templates where cohort_id = ${cohortId} and kind = 'saved' order by name`;
}

export async function saveSavedTemplate(actor: Account, cohortId: string, input: Record<string, string>) {
  const v = parse(contentSchema, input);
  const name = parse(z.object({ name: requiredText(120, "Template name") }), { name: input.templateName ?? "" }).name;
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [existing] = await t`select id from email_templates where cohort_id = ${cohortId} and kind = 'saved' and lower(name) = lower(${name})`;
    if (existing) await t`update email_templates set subject = ${v.subject}, body = ${v.body}, updated_by = ${actor.id}, updated_at = now() where id = ${existing.id}`;
    else await t`insert into email_templates (cohort_id, kind, name, subject, body, updated_by) values (${cohortId}, 'saved', ${name}, ${v.subject}, ${v.body}, ${actor.id})`;
    return existing ? "updated" : "created";
  });
}

export async function deleteSavedTemplate(actor: Account, cohortId: string, id: string) {
  await tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    await t`delete from email_templates where id = ${id} and cohort_id = ${cohortId} and kind = 'saved'`;
  });
}

// ───────────────────────────── Messages to startups ────────────────────────

const messageSchema = z
  .object({
    audience: z.enum(["all", "selected", "missing_weekly"]),
    enrollmentIds: z.array(z.string().uuid()).default([]),
    includeMentors: z.boolean().default(false),
    copyMe: z.boolean().default(false),
  })
  .and(contentSchema);
export type MessageInput = z.input<typeof messageSchema>;

type Recipient = { email: string; accountId: string | null; name: string; startup: string; enrollmentId: string | null; viaContact: boolean; kind: "founder" | "mentor" | "you" };

function currentWeek(a: CohortAccess) {
  const today = todayIn(a.cohort.timezone);
  const week = weekNumberFor(a.cohort.startDate, a.cohort.weekCount, today);
  return { week, range: week ? programWeeks(a.cohort.startDate, a.cohort.weekCount)[week - 1] : null };
}

async function resolveRecipients(db: Db, a: CohortAccess, actor: Account, v: z.infer<typeof messageSchema>) {
  const cohortId = a.cohort.id;
  let ids: string[];
  if (v.audience === "all") ids = (await db`select id from enrollments where cohort_id = ${cohortId} and status = 'active'`).map((r) => r.id as string);
  else if (v.audience === "selected") {
    if (!v.enrollmentIds.length) throw invalid("Choose at least one startup.");
    ids = (await db`select id from enrollments where cohort_id = ${cohortId} and status = 'active' and id = any(${v.enrollmentIds})`).map((r) => r.id as string);
  } else {
    const { week } = currentWeek(a);
    if (!week) throw invalid("There's no current program week, so “missing this week's summary” doesn't apply. Choose all or selected startups.");
    ids = (
      await db`select e.id from enrollments e where e.cohort_id = ${cohortId} and e.status = 'active' and not exists (
                 select 1 from team_updates u where u.enrollment_id = e.id and u.kind = 'weekly' and u.week_number = ${week} and u.state = 'published')`
    ).map((r) => r.id as string);
  }
  const out: Recipient[] = [];
  const seen = new Set<string>();
  const push = (r: Recipient) => {
    if (seen.has(r.email)) return;
    seen.add(r.email);
    out.push(r);
  };
  if (ids.length) {
    const founders = await db`
      select e.id as enrollment_id, s.name as startup, a.id as account_id, a.email, a.display_name
      from enrollments e join startups s on s.id = e.startup_id
      join startup_memberships m on m.enrollment_id = e.id and m.active join accounts a on a.id = m.account_id and a.state = 'active'
      where e.id = any(${ids}) order by s.name, a.display_name`;
    for (const f of founders) push({ email: f.email, accountId: f.account_id, name: f.display_name, startup: f.startup, enrollmentId: f.enrollment_id, viaContact: false, kind: "founder" });
    // Startups whose founders haven't set up accounts yet still hear from you, at their contact email.
    const withFounders = new Set(founders.map((f) => f.enrollment_id as string));
    const contacts = await db`select e.id, e.contact_name, e.contact_email, s.name from enrollments e join startups s on s.id = e.startup_id where e.id = any(${ids}) order by s.name`;
    for (const c of contacts)
      if (!withFounders.has(c.id)) push({ email: c.contact_email, accountId: null, name: c.contact_name, startup: c.name, enrollmentId: c.id, viaContact: true, kind: "founder" });
  }
  if (v.includeMentors) {
    const mentors = await db`select a.id, a.email, a.display_name from cohort_roles r join accounts a on a.id = r.account_id and a.state = 'active'
                             where r.cohort_id = ${cohortId} and r.role = 'mentor' and r.active order by a.display_name`;
    for (const m of mentors) push({ email: m.email, accountId: m.id, name: m.display_name, startup: "", enrollmentId: null, viaContact: false, kind: "mentor" });
  }
  if (v.copyMe) push({ email: actor.email, accountId: actor.id, name: actor.displayName, startup: out.find((r) => r.startup)?.startup ?? "", enrollmentId: null, viaContact: false, kind: "you" });
  if (out.length > MAX_RECIPIENTS) throw invalid(`That's more than ${MAX_RECIPIENTS} people. Send to fewer startups at a time.`);
  return { recipients: out, enrollmentIds: ids };
}

function messageEmail(base: Awaited<ReturnType<typeof baseVars>>, actor: Account, v: { subject: string; body: string }, r: Recipient, cohortId: string) {
  const vars: MergeVars = { ...base, first_name: firstName(r.name), full_name: r.name, startup_name: r.startup, inviter_name: actor.displayName };
  return {
    org: base.org,
    support: base.support,
    replyTo: base.support,
    subject: merge(v.subject, vars),
    body: merge(v.body, vars),
    // People without an account yet can't open the platform, so they get no button.
    url: r.viaContact ? null : `${env().APP_URL}/app/cohorts/${cohortId}`,
    buttonLabel: "Open the platform",
  };
}

/** Who would get the message and what it looks like for one of them. Sends nothing. */
export async function previewMessage(actor: Account, cohortId: string, input: MessageInput) {
  const v = parse(messageSchema, input);
  const db = sql();
  const a = await requireCohortAdmin(actor, cohortId, db);
  assertAdminWritable(a);
  const { recipients, enrollmentIds } = await resolveRecipients(db, a, actor, v);
  const base = await baseVars(db, cohortId, actor.organizationId);
  const sample = recipients.find((r) => r.kind === "founder") ?? recipients[0];
  const rendered = sample ? render("custom", messageEmail(base, actor, v, sample, cohortId)) : null;
  const { week } = currentWeek(a);
  return {
    count: recipients.length,
    startups: enrollmentIds.length,
    viaContact: recipients.filter((r) => r.viaContact).length,
    week,
    recipients: recipients.slice(0, 300).map((r) => ({ email: r.email, name: r.name, startup: r.startup, viaContact: r.viaContact, kind: r.kind })),
    sample: rendered ? { to: sample!.email, subject: rendered.subject, html: rendered.html } : null,
  };
}

/** Queue one personal email per recipient. Safe to retry with the same key. */
export async function sendMessage(actor: Account, cohortId: string, input: MessageInput & { idempotencyKey: string }) {
  const v = parse(messageSchema, input);
  const key = z.string().min(8).max(100).parse(input.idempotencyKey);
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [prior] = await t`select id, recipient_count from cohort_messages where idempotency_key = ${key} and cohort_id = ${cohortId}`;
    if (prior) return { id: prior.id as string, queued: prior.recipient_count as number };
    const { recipients, enrollmentIds } = await resolveRecipients(t, a, actor, v);
    if (!recipients.length) throw invalid("Nobody matches this selection, so nothing was sent.");
    const [m] = await t`insert into cohort_messages (cohort_id, subject, body, audience, enrollment_ids, include_mentors, recipient_count, sent_by, idempotency_key)
                        values (${cohortId}, ${v.subject}, ${v.body}, ${v.audience}, ${enrollmentIds}, ${v.includeMentors}, ${recipients.length}, ${actor.id}, ${key}) returning id`;
    const base = await baseVars(t, cohortId, actor.organizationId);
    for (const r of recipients)
      await enqueueEmail(t, {
        eventType: "message",
        template: "custom",
        to: r.email,
        recipientAccountId: r.accountId,
        cohortId,
        authorizedBy: actor.id,
        payload: messageEmail(base, actor, v, r, cohortId),
        related: { type: "message", id: m.id },
        idempotencyKey: `message:${m.id}:${r.email}`,
      });
    await audit(t, { actorId: actor.id, action: "message.send", objectType: "message", objectId: m.id, cohortId, summary: { audience: v.audience, recipients: recipients.length } });
    return { id: m.id as string, queued: recipients.length };
  });
}

export async function listMessages(actor: Account, cohortId: string, opts: { enrollmentId?: string; limit?: number } = {}) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`
    select m.id, m.subject, m.audience, m.recipient_count, m.include_mentors, m.created_at, a.display_name as sender,
      coalesce((select jsonb_object_agg(state, n) from (select o.state, count(*)::int as n from email_outbox o
                where o.related_type = 'message' and o.related_id = m.id group by o.state) x), '{}'::jsonb) as states
    from cohort_messages m join accounts a on a.id = m.sent_by
    where m.cohort_id = ${cohortId} ${opts.enrollmentId ? sql()`and ${opts.enrollmentId}::uuid = any(m.enrollment_ids)` : sql()``}
    order by m.created_at desc limit ${opts.limit ?? 50}`;
}

export const audienceLabel = (a: string) => (a === "all" ? "All startups" : a === "selected" ? "Selected startups" : "Missing weekly summary");
