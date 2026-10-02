import "server-only";
import { z } from "zod";
import { email as emailSchema, requiredText } from "@/lib/validation";
import { audit } from "../audit";
import { auth, PASSWORD_MIN } from "../auth";
import { sql, tx } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import { AppError, conflict, forbidden, invalid } from "../errors";
import { rateLimit } from "../rate-limit";
import type { Account } from "../session";
import { consumeInvitation, landingFor, lookupInvitation } from "./invitations";
import { getOrganization } from "./organization";
import { parse } from "./validate";

const password = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(128, "Use 128 characters or fewer.");

const newAccountSchema = z.object({
  displayName: requiredText(120, "Your name"),
  password,
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

/**
 * New-account invitation acceptance. Mailbox control is proven by the
 * single-use link that was sent only to the invited address.
 */
export async function acceptWithNewAccount(token: string, input: { displayName: string; password: string; confirm: string }, ip: string) {
  await rateLimit(`accept:${ip}`, 20, 900);
  const v = parse(newAccountSchema, input);
  const inv = await lookupInvitation(token);
  if (!inv || inv.status !== "open") throw forbidden("This invitation is no longer valid.");
  const [existing] = await sql()`select id from accounts where email = ${inv.email}`;
  if (existing) throw new AppError("conflict", "An account already exists for this email. Sign in to accept the invitation.");

  let subject: string | null = null;
  const created = await auth().createConfirmedUser(inv.email, v.password);
  if (created.ok) subject = created.subject;
  else if (created.reason === "exists") {
    // A previous attempt created the identity but didn't finish; the same
    // password proves it was this person.
    subject = await auth().signIn(inv.email, v.password);
    if (!subject) throw conflict("An account already exists for this email. Sign in, or reset your password from the sign-in page.");
  } else if (created.reason === "weak_password") throw invalid(created.message ?? "Choose a stronger password.", { password: created.message ?? "Choose a stronger password." });
  else throw new Error(`identity provider: ${created.message}`);

  const consumed = await tx(async (t) => {
    const [acct] = await t`
      insert into accounts (organization_id, auth_subject, email, display_name)
      select organization_id, ${subject}, ${inv.email}, ${v.displayName} from invitations where id = ${inv.id}
      on conflict (auth_subject) do update set display_name = excluded.display_name
      returning id, email, organization_id`;
    return consumeInvitation(t, token, { id: acct.id, email: acct.email, organizationId: acct.organization_id });
  });
  if (!(await auth().getSessionUser())) await auth().signIn(inv.email, v.password);
  return landingFor(consumed);
}

/** Existing-account acceptance: signed in as the invited address. */
export async function acceptAsExisting(actor: Account, token: string) {
  const consumed = await tx((t) => consumeInvitation(t, token, actor));
  return landingFor(consumed);
}

export async function signIn(emailInput: string, pw: string, ip: string) {
  const e = emailInput.trim().toLowerCase();
  await rateLimit(`signin:ip:${ip}`, 30, 900);
  await rateLimit(`signin:email:${e}`, 8, 900);
  const subject = await auth().signIn(e, pw);
  if (!subject) throw invalid("That email and password don't match an account.");
  const [acct] = await sql()`select state from accounts where auth_subject = ${subject}`;
  if (acct?.state === "suspended") {
    await auth().signOut("local");
    throw forbidden("This account is suspended. Contact the program administrator.");
  }
}

/** Always responds the same way; never reveals whether an address has an account. */
export async function requestPasswordReset(emailInput: string, ip: string) {
  const parsed = emailSchema.safeParse(emailInput);
  if (!parsed.success) throw invalid("Enter a valid email address.", { email: "Enter a valid email address." });
  const e = parsed.data;
  await rateLimit(`reset:ip:${ip}`, 10, 3600);
  await rateLimit(`reset:email:${e}`, 3, 3600);
  const [acct] = await sql()`select id, organization_id from accounts where email = ${e} and state = 'active'`;
  if (!acct) return;
  const tokenHash = await auth().generateRecoveryToken(e);
  if (!tokenHash) return;
  const org = await getOrganization(sql(), acct.organization_id);
  await enqueueEmail(sql(), {
    eventType: "password_reset",
    template: "password_reset",
    to: e,
    recipientAccountId: acct.id,
    payload: { org: org?.name, support: org?.supportEmail },
    secret: { link: `${env().APP_URL}/auth/confirm?type=recovery&token_hash=${encodeURIComponent(tokenHash)}` },
    idempotencyKey: `reset:${acct.id}:${tokenHash.slice(0, 16)}`,
  });
}

/** POST-only token verification (email scanners' GETs can't consume it). */
export async function confirmEmailToken(type: string, tokenHash: string) {
  if (type !== "recovery" && type !== "email_change") throw invalid("This link isn't valid.");
  const ok = await auth().verifyToken(type, tokenHash);
  if (!ok) throw invalid("This link is invalid or has expired. Request a new one.");
  return type === "recovery" ? "/reset-password" : "/app/account?email=changed";
}

export async function setNewPassword(input: { password: string; confirm: string }) {
  const v = parse(z.object({ password, confirm: z.string() }).refine((x) => x.password === x.confirm, { path: ["confirm"], message: "Passwords don't match." }), input);
  const r = await auth().updatePassword(v.password);
  if (!r.ok) throw invalid(r.message, { password: r.message });
  // A reset ends every other session for this account.
  await auth().signOut("others");
}

export async function updateDisplayName(actor: Account, name: string) {
  const v = parse(z.object({ name: requiredText(120, "Name") }), { name });
  await sql()`update accounts set display_name = ${v.name}, updated_at = now() where id = ${actor.id}`;
}

/** Sends a confirmation link to the new address; nothing changes until it's used. */
export async function requestEmailChange(actor: Account, currentPassword: string, newEmail: string, ip: string) {
  const v = parse(z.object({ newEmail: emailSchema }), { newEmail });
  await rateLimit(`emailchange:${actor.id}`, 5, 3600);
  if (v.newEmail === actor.email) throw invalid("That's already your email.", { newEmail: "That's already your email." });
  await rateLimit(`signin:ip:${ip}`, 30, 900);
  const subject = await auth().signIn(actor.email, currentPassword);
  if (!subject) throw invalid("Your current password is incorrect.", { currentPassword: "Incorrect password." });
  const [taken] = await sql()`select 1 from accounts where email = ${v.newEmail}`;
  // Same response either way to avoid confirming which addresses exist.
  if (taken) return;
  const tokenHash = await auth().generateEmailChangeToken(actor.email, v.newEmail);
  if (!tokenHash) return;
  const org = await getOrganization(sql(), actor.organizationId);
  await enqueueEmail(sql(), {
    eventType: "email_change",
    template: "email_change",
    to: v.newEmail,
    recipientAccountId: actor.id,
    payload: { org: org?.name, support: org?.supportEmail, newEmail: v.newEmail },
    secret: { link: `${env().APP_URL}/auth/confirm?type=email_change&token_hash=${encodeURIComponent(tokenHash)}` },
    idempotencyKey: `emailchange:${actor.id}:${tokenHash.slice(0, 16)}`,
  });
  await audit(sql(), { actorId: actor.id, action: "account.email_change_requested", objectType: "account", objectId: actor.id });
}

/** Owner: suspend/reactivate. The last active owner can never be suspended. */
export async function setAccountState(actor: Account, accountId: string, state: "active" | "suspended") {
  if (!actor.isOwner) throw forbidden("Only platform owners can suspend accounts.");
  return tx(async (t) => {
    const [target] = await t`select * from accounts where id = ${accountId} and organization_id = ${actor.organizationId} for update`;
    if (!target) throw invalid("Account not found.");
    if (state === "suspended" && target.is_owner) {
      const [n] = await t`select count(*)::int as n from accounts where is_owner and state = 'active' and organization_id = ${actor.organizationId}`;
      if (n.n <= 1) throw forbidden("You can't suspend the last active platform owner.");
    }
    await t`update accounts set state = ${state}, updated_at = now() where id = ${accountId}`;
    await audit(t, { actorId: actor.id, action: `account.${state}`, objectType: "account", objectId: accountId });
  });
}

export async function removeOwner(actor: Account, accountId: string) {
  if (!actor.isOwner) throw forbidden();
  return tx(async (t) => {
    await t`select id from accounts where is_owner and organization_id = ${actor.organizationId} for update`;
    const [n] = await t`select count(*)::int as n from accounts where is_owner and state = 'active' and organization_id = ${actor.organizationId}`;
    if (n.n <= 1) throw forbidden("You can't remove the last active platform owner.");
    await t`update accounts set is_owner = false, updated_at = now() where id = ${accountId}`;
    await audit(t, { actorId: actor.id, action: "account.owner_removed", objectType: "account", objectId: accountId });
  });
}
