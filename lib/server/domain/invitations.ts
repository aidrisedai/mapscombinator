import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { formatInstant } from "@/lib/time";
import { email as emailSchema, text } from "@/lib/validation";
import { audit } from "../audit";
import { cohortAccess, isUuid, requireCohortAdmin } from "../authz";
import { sql, tx, type Db, type Tx } from "../db";
import { enqueueEmail, retryOutbox } from "../email/outbox";
import { render } from "../email/templates";
import { env } from "../env";
import { conflict, forbidden, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { getOrganization } from "./organization";
import { parse } from "./validate";

export type InviteRole = "owner" | "admin" | "mentor" | "viewer" | "founder";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = sha256;
const OPEN = ["queued", "sent", "delivery_failed"];

const inviteSchema = z.object({
  role: z.enum(["owner", "admin", "mentor", "viewer", "founder"]),
  email: emailSchema,
  name: text(120, "Name").optional().transform((v) => v || null),
  cohortId: z.string().uuid().nullable().optional(),
  enrollmentId: z.string().uuid().nullable().optional(),
});
export type InviteInput = z.input<typeof inviteSchema>;

/** Who may invite whom (server-side; never from the browser). */
async function authorizeInvite(actor: Account, v: z.infer<typeof inviteSchema>, db: Db) {
  if (v.role === "owner") {
    if (!actor.isOwner) throw forbidden("Only platform owners can invite owners.");
    return { cohort: null, startup: null };
  }
  if (!v.cohortId) throw invalid("Choose a cohort.");
  const a = await cohortAccess(actor, v.cohortId, db);
  if (!a || !a.isAdmin) throw forbidden("Only this cohort's administrators can send invitations.");
  if (a.cohort.status === "archived") throw forbidden("This cohort is archived.");
  if (v.role === "admin" && !actor.isOwner) throw forbidden("Only platform owners can add cohort administrators.");
  let startup: string | null = null;
  if (v.role === "founder") {
    if (!v.enrollmentId) throw invalid("Choose a startup.");
    const [e] = await db`select s.name from enrollments e join startups s on s.id = e.startup_id
                         where e.id = ${v.enrollmentId} and e.cohort_id = ${v.cohortId} and e.status = 'active'`;
    if (!e) throw notFound("That startup isn't enrolled in this cohort.");
    startup = e.name as string;
  } else if (v.enrollmentId) throw invalid("Only founder invitations belong to a startup.");
  return { cohort: a.cohort, startup };
}

/** Does this email already hold the access being offered? */
async function alreadyHasAccess(db: Db, v: z.infer<typeof inviteSchema>) {
  const [acct] = await db`select id, is_owner from accounts where email = ${v.email}`;
  if (!acct) return false;
  if (v.role === "owner") return acct.is_owner as boolean;
  if (v.role === "founder") {
    const [m] = await db`select 1 from startup_memberships where account_id = ${acct.id} and enrollment_id = ${v.enrollmentId!} and active`;
    return Boolean(m);
  }
  const [r] = await db`select 1 from cohort_roles where account_id = ${acct.id} and cohort_id = ${v.cohortId!} and role = ${v.role} and active`;
  return Boolean(r);
}

type InvitationContext = { org: string; support: string | null; cohort: string | null; startup: string | null; inviter: string; expires: string };

function payloadFor(email: string, role: string, ctx: InvitationContext) {
  return { org: ctx.org, support: ctx.support, replyTo: ctx.support, cohort: ctx.cohort, startup: ctx.startup, role, inviter: ctx.inviter, expires: ctx.expires, email };
}

/** Exact message the admin sees before confirming. */
export async function previewInvitation(actor: Account, input: InviteInput) {
  const v = parse(inviteSchema, input);
  const db = sql();
  const { cohort, startup } = await authorizeInvite(actor, v, db);
  const org = (await getOrganization(db, actor.organizationId))!;
  const expiresAt = new Date(Date.now() + org.invitationValidDays * 86400_000);
  const tz = cohort?.timezone ?? "America/Los_Angeles";
  const ctx = { org: org.name, support: cohort?.supportEmail ?? org.supportEmail, cohort: cohort?.name ?? null, startup, inviter: actor.displayName, expires: formatInstant(expiresAt, tz) };
  const msg = render("invitation", payloadFor(v.email, v.role, ctx), { link: `${env().APP_URL}/accept-invitation#•••` });
  return { to: v.email, role: v.role, cohort: cohort?.name ?? null, startup, subject: msg.subject, text: msg.text, alreadyHasAccess: await alreadyHasAccess(db, v) };
}

async function issue(t: Tx, actor: Account | null, invitationId: string, sendNumber: number) {
  const [inv] = await t`
    select i.*, c.name as cohort_name, c.timezone, c.support_email as cohort_support, s.name as startup_name, a.display_name as inviter_name
    from invitations i
    left join cohorts c on c.id = i.cohort_id
    left join enrollments e on e.id = i.enrollment_id
    left join startups s on s.id = e.startup_id
    left join accounts a on a.id = i.invited_by
    where i.id = ${invitationId}`;
  const org = (await getOrganization(t, inv.organization_id))!;
  const token = newToken();
  const expiresAt = new Date(Date.now() + org.invitationValidDays * 86400_000);
  await t`update invitations set token_hash = ${sha256(token)}, expires_at = ${expiresAt}, state = 'queued', delivery_state = 'queued',
          send_count = ${sendNumber} where id = ${invitationId}`;
  const ctx = {
    org: org.name,
    support: inv.cohort_support ?? org.supportEmail,
    cohort: inv.cohort_name,
    startup: inv.startup_name,
    inviter: actor?.displayName ?? inv.inviter_name ?? org.name,
    expires: formatInstant(expiresAt, inv.timezone ?? "America/Los_Angeles"),
  };
  await enqueueEmail(t, {
    eventType: "invitation",
    template: "invitation",
    to: inv.email,
    cohortId: inv.cohort_id,
    authorizedBy: actor?.id ?? null,
    payload: payloadFor(inv.email, inv.role, ctx),
    secret: { link: `${env().APP_URL}/accept-invitation#${token}` },
    related: { type: "invitation", id: invitationId },
    idempotencyKey: `invitation:${invitationId}:${sendNumber}`,
  });
  return token;
}

/**
 * Create and queue an invitation. Idempotent per person/scope: an open
 * invitation for the same scope is reported, not duplicated.
 */
export async function createInvitation(actor: Account, input: InviteInput) {
  const v = parse(inviteSchema, input);
  return tx(async (t) => {
    await authorizeInvite(actor, v, t);
    if (await alreadyHasAccess(t, v)) throw conflict(`${v.email} already has this access.`);
    const existing = await t`select id from invitations where email = ${v.email} and role = ${v.role}
      and cohort_id is not distinct from ${v.cohortId ?? null} and enrollment_id is not distinct from ${v.enrollmentId ?? null}
      and state = any(${OPEN})`;
    if (existing[0]) throw conflict("This person already has a pending invitation. Use Resend instead.");
    const [inv] = await t`
      insert into invitations (organization_id, email, invitee_name, role, cohort_id, enrollment_id, invited_by, token_hash, expires_at)
      values (${actor.organizationId}, ${v.email}, ${v.name}, ${v.role}, ${v.cohortId ?? null}, ${v.enrollmentId ?? null}, ${actor.id},
              ${sha256(newToken())}, now())
      returning id`;
    await issue(t, actor, inv.id, 1);
    await audit(t, { actorId: actor.id, action: "invitation.create", objectType: "invitation", objectId: inv.id, cohortId: v.cohortId ?? null, summary: { role: v.role, email: v.email } });
    return inv.id as string;
  });
}

async function loadForManage(t: Tx, actor: Account, invitationId: string) {
  const [inv] = await t`select * from invitations where id = ${invitationId} and organization_id = ${actor.organizationId} for update`;
  if (!inv) throw notFound("Invitation not found.");
  if (inv.role === "owner" || inv.role === "admin") {
    if (!actor.isOwner) throw forbidden("Only platform owners can manage this invitation.");
  } else {
    const a = await cohortAccess(actor, inv.cohort_id, t);
    if (!a?.isAdmin) throw notFound("Invitation not found.");
  }
  return inv;
}

/** Resend rotates the token (old links stop working) and queues a new email. */
export async function resendInvitation(actor: Account, invitationId: string) {
  return tx(async (t) => {
    const inv = await loadForManage(t, actor, invitationId);
    if (inv.state === "accepted") throw conflict("This invitation was already accepted. The person can reset their password from the sign-in page.");
    if (inv.state === "revoked") throw conflict("This invitation was revoked. Create a new invitation instead.");
    await issue(t, actor, invitationId, (inv.send_count as number) + 1);
    await t`update invitation_help_requests set handled_at = now() where invitation_id = ${invitationId} and handled_at is null`;
    await audit(t, { actorId: actor.id, action: "invitation.resend", objectType: "invitation", objectId: invitationId, cohortId: inv.cohort_id });
  });
}

export async function revokeInvitation(actor: Account, invitationId: string) {
  return tx(async (t) => {
    const inv = await loadForManage(t, actor, invitationId);
    if (inv.state === "accepted") throw conflict("Already accepted. Remove the person's membership instead.");
    if (inv.state === "revoked") return;
    await t`update invitations set state = 'revoked', revoked_at = now(), revoked_by = ${actor.id} where id = ${invitationId}`;
    // Pending, unsent copies are withdrawn so a revoked link is never delivered late.
    await t`update email_outbox set state = 'suppressed', last_error = 'Not sent: invitation revoked', secret_payload = null
            where related_type = 'invitation' and related_id = ${invitationId} and state = 'queued'`;
    await audit(t, { actorId: actor.id, action: "invitation.revoke", objectType: "invitation", objectId: invitationId, cohortId: inv.cohort_id });
  });
}

export type InvitationView = {
  id: string;
  email: string;
  role: InviteRole;
  status: "open" | "expired" | "revoked" | "accepted";
  org: string;
  cohort: string | null;
  cohortId: string | null;
  startup: string | null;
  enrollmentId: string | null;
  inviter: string | null;
  expiresAt: Date;
  timezone: string;
  support: string | null;
};

/** Read-only lookup for the acceptance page. GET never consumes a token. */
export async function lookupInvitation(token: string, db: Db = sql()): Promise<InvitationView | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [i] = await db`
    select i.*, o.name as org_name, o.support_email as org_support, c.name as cohort_name, c.timezone, c.support_email as cohort_support,
           s.name as startup_name, a.display_name as inviter_name
    from invitations i join organizations o on o.id = i.organization_id
    left join cohorts c on c.id = i.cohort_id
    left join enrollments e on e.id = i.enrollment_id
    left join startups s on s.id = e.startup_id
    left join accounts a on a.id = i.invited_by
    where i.token_hash = ${sha256(token)}`;
  if (!i) return null;
  let status: InvitationView["status"] = "open";
  if (i.state === "accepted") status = "accepted";
  else if (i.state === "revoked") status = "revoked";
  else if (i.state === "expired" || new Date(i.expires_at) < new Date()) status = "expired";
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    status,
    org: i.org_name,
    cohort: i.cohort_name,
    cohortId: i.cohort_id,
    startup: i.startup_name,
    enrollmentId: i.enrollment_id,
    inviter: i.inviter_name,
    expiresAt: new Date(i.expires_at),
    timezone: i.timezone ?? "America/Los_Angeles",
    support: i.cohort_support ?? i.org_support,
  };
}

/**
 * Consume an invitation for an account, atomically and exactly once. The
 * account's verified email must equal the invited address.
 */
export async function consumeInvitation(t: Tx, token: string, account: { id: string; email: string; organizationId: string }) {
  const [inv] = await t`select * from invitations where token_hash = ${sha256(token)} for update`;
  if (!inv) throw notFound("This invitation link isn't valid.");
  if (inv.organization_id !== account.organizationId) throw forbidden("This invitation belongs to a different organization.");
  if (inv.email !== account.email) throw forbidden("This invitation was sent to a different email address.");
  if (inv.state === "accepted") {
    if (inv.accepted_account_id === account.id) return inv; // retry of a completed acceptance
    throw conflict("This invitation was already used.");
  }
  if (inv.state === "revoked") throw forbidden("This invitation was revoked.");
  if (new Date(inv.expires_at) < new Date()) {
    await t`update invitations set state = 'expired' where id = ${inv.id}`;
    throw forbidden("This invitation has expired.");
  }
  switch (inv.role as InviteRole) {
    case "owner":
      await t`update accounts set is_owner = true, updated_at = now() where id = ${account.id}`;
      break;
    case "founder": {
      const [e] = await t`select status from enrollments where id = ${inv.enrollment_id}`;
      if (e?.status !== "active") throw forbidden("This startup is no longer enrolled in the cohort.");
      await t`insert into startup_memberships (enrollment_id, account_id) values (${inv.enrollment_id}, ${account.id})
              on conflict (enrollment_id, account_id) do update set active = true, removed_at = null, removed_by = null`;
      break;
    }
    default:
      await t`insert into cohort_roles (cohort_id, account_id, role, granted_by)
              values (${inv.cohort_id}, ${account.id}, ${inv.role}, ${inv.invited_by})
              on conflict (cohort_id, account_id, role) where active do nothing`;
      if (inv.role === "mentor") await t`insert into mentor_profiles (account_id) values (${account.id}) on conflict do nothing`;
  }
  await t`update invitations set state = 'accepted', accepted_at = now(), accepted_account_id = ${account.id} where id = ${inv.id}`;
  await audit(t, { actorId: account.id, action: "invitation.accept", objectType: "invitation", objectId: inv.id, cohortId: inv.cohort_id, summary: { role: inv.role } });
  return inv;
}

/** Where an accepted invitation should land. */
export function landingFor(row: Record<string, unknown>) {
  const inv = row as { role: string; cohort_id: string | null; enrollment_id: string | null };
  if (inv.role === "owner") return "/manage/cohorts";
  if (inv.role === "admin") return `/manage/cohorts/${inv.cohort_id}`;
  if (inv.role === "mentor") return "/mentor/profile?welcome=1";
  if (inv.role === "founder") return `/app/cohorts/${inv.cohort_id}?team=${inv.enrollment_id}&welcome=1`;
  return `/app/cohorts/${inv.cohort_id}/journal`;
}

/** Expired/revoked link holders can ask for a new invite. Creates no access. */
export async function requestNewInvitation(token: string) {
  const [inv] = await sql()`select id from invitations where token_hash = ${sha256(token)} and state <> 'accepted'`;
  if (!inv) return;
  const [open] = await sql()`select 1 from invitation_help_requests where invitation_id = ${inv.id} and handled_at is null`;
  if (!open) await sql()`insert into invitation_help_requests (invitation_id) values (${inv.id})`;
}

export async function listInvitations(cohortId: string, enrollmentId?: string) {
  return sql()`
    select i.id, i.email, i.invitee_name, i.role, i.state, i.delivery_state, i.created_at, i.expires_at, i.last_sent_at, i.send_count,
           i.accepted_at, i.enrollment_id,
           (select count(*)::int from invitation_help_requests h where h.invitation_id = i.id and h.handled_at is null) as help_requests,
           (select o.last_error from email_outbox o where o.related_type = 'invitation' and o.related_id = i.id order by o.created_at desc limit 1) as last_error
    from invitations i
    where i.cohort_id = ${cohortId} and (${enrollmentId ?? null}::uuid is null or i.enrollment_id = ${enrollmentId ?? null})
    order by i.created_at desc`;
}

export function invitationStatusLabel(i: { state: string; delivery_state: string; expires_at: Date | string }) {
  if (i.state === "accepted") return "Accepted";
  if (i.state === "revoked") return "Revoked";
  if (new Date(i.expires_at) < new Date() || i.state === "expired") return "Expired";
  switch (i.delivery_state) {
    case "queued":
    case "sending":
      return "Queued";
    case "provider_accepted":
      return "Sent (delivery not yet confirmed)";
    case "delivered":
      return "Delivered";
    case "bounced":
      return "Bounced";
    case "complained":
      return "Marked as spam";
    case "failed":
      return "Delivery failed";
    case "suppressed":
      return "Not sent (sandbox/test mode)";
    default:
      return i.delivery_state;
  }
}

/** Platform-owner invitations (owner role has no cohort). */
export async function listOwnerInvitations(actor: Account) {
  if (!actor.isOwner) throw forbidden("Only platform owners can see owner invitations.");
  return sql()`
    select i.id, i.email, i.invitee_name, i.role, i.state, i.delivery_state, i.created_at, i.expires_at, i.last_sent_at, i.send_count,
           i.accepted_at,
           (select count(*)::int from invitation_help_requests h where h.invitation_id = i.id and h.handled_at is null) as help_requests,
           (select o.last_error from email_outbox o where o.related_type = 'invitation' and o.related_id = i.id order by o.created_at desc limit 1) as last_error
    from invitations i
    where i.organization_id = ${actor.organizationId} and i.role = 'owner' and i.state not in ('accepted', 'revoked')
    order by i.created_at desc`;
}

export const OUTBOX_STATES = ["queued", "sending", "provider_accepted", "delivered", "bounced", "complained", "failed", "suppressed"] as const;
export type OutboxState = (typeof OUTBOX_STATES)[number];
export const OUTBOX_PAGE_SIZE = 50;

/** Email delivery log for one cohort (administrators only). Secrets are never selected. */
export async function listCohortOutbox(actor: Account, cohortId: string, f: { state?: string | null; page?: number }) {
  await requireCohortAdmin(actor, cohortId);
  const db = sql();
  const state = f.state && (OUTBOX_STATES as readonly string[]).includes(f.state) ? f.state : null;
  const page = Math.max(1, Math.min(1000, Math.floor(f.page ?? 1)));
  const rows = await db`
    select id, created_at, updated_at, event_type, recipient_email, state, attempts, attempted_at, last_error
    from email_outbox
    where cohort_id = ${cohortId} and (${state}::text is null or state = ${state})
    order by created_at desc, id
    limit ${OUTBOX_PAGE_SIZE + 1} offset ${(page - 1) * OUTBOX_PAGE_SIZE}`;
  const counts = await db`select state, count(*)::int as n from email_outbox where cohort_id = ${cohortId} group by state`;
  return {
    items: rows.slice(0, OUTBOX_PAGE_SIZE),
    hasMore: rows.length > OUTBOX_PAGE_SIZE,
    page,
    state,
    counts: Object.fromEntries(counts.map((c) => [c.state as string, c.n as number])) as Partial<Record<OutboxState, number>>,
  };
}

/** Admin retry of one failed message in this cohort (same provider idempotency key). */
export async function retryCohortEmail(actor: Account, cohortId: string, outboxId: string) {
  if (!isUuid(outboxId)) throw notFound("We couldn't find that message.");
  await tx(async (t) => {
    await requireCohortAdmin(actor, cohortId, t);
    const ok = await retryOutbox(t, outboxId, cohortId);
    if (!ok) throw conflict("This message is no longer in a failed state. Reload to see its current status.");
    await audit(t, { actorId: actor.id, action: "email.retry", objectType: "email_outbox", objectId: outboxId, cohortId });
  });
}
