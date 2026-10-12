import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { sql, tx } from "../db";
import { enqueueEmail } from "../email/outbox";
import { AppError, forbidden, invalid } from "../errors";
import { rateLimit } from "../rate-limit";
import { lookupInvitation } from "./invitations";
import { getOrganization } from "./organization";

export const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** After a code is confirmed, the person has this long to finish creating their account. */
const VERIFIED_FOR_MINUTES = 120;

const hashCode = (invitationId: string, code: string) => createHash("sha256").update(`${invitationId}:${code}`).digest("hex");

/** Owner invitations come from the operator's command line (bootstrap) and skip the code step. */
export const needsEmailCode = (role: string) => role !== "owner";

async function openInvitation(token: string) {
  const inv = await lookupInvitation(token);
  if (!inv || inv.status !== "open") throw forbidden("This invitation is no longer valid.");
  return inv;
}

/** Email a fresh 6-digit code to the invited address. Earlier unused codes stop working. */
export async function sendInvitationCode(token: string, ip: string) {
  await rateLimit(`invcode:send:ip:${ip}`, 20, 900);
  const inv = await openInvitation(token);
  if (!needsEmailCode(inv.role)) throw invalid("This invitation doesn't need a code.");
  await rateLimit(`invcode:send:inv:${inv.id}`, 5, 900);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await tx(async (t) => {
    await t`update invitation_email_codes set expires_at = now() where invitation_id = ${inv.id} and verified_at is null and expires_at > now()`;
    const [row] = await t`insert into invitation_email_codes (invitation_id, code_hash, expires_at)
                          values (${inv.id}, ${hashCode(inv.id, code)}, now() + make_interval(mins => ${CODE_MINUTES})) returning id`;
    const [i] = await t`select organization_id from invitations where id = ${inv.id}`;
    const org = await getOrganization(t, i.organization_id);
    await enqueueEmail(t, {
      eventType: "verification_code",
      template: "verification_code",
      to: inv.email,
      cohortId: inv.cohortId,
      payload: { org: org?.name, support: inv.support, replyTo: inv.support, cohort: inv.cohort, minutes: String(CODE_MINUTES) },
      secret: { code },
      related: { type: "invitation", id: inv.id },
      idempotencyKey: `invcode:${row.id}`,
    });
  });
  return { email: inv.email, minutes: CODE_MINUTES };
}

export async function verifyInvitationCode(token: string, codeInput: string, ip: string) {
  await rateLimit(`invcode:verify:ip:${ip}`, 30, 900);
  const inv = await openInvitation(token);
  const code = codeInput.replace(/\D/g, "");
  if (code.length !== 6) throw invalid("Enter the 6-digit code from the email.", { code: "Enter the 6-digit code from the email." });
  // Count the attempt in its own committed statement, so a wrong code (which
  // throws) can't roll the counter back.
  const [row] = await sql()`
    update invitation_email_codes set attempts = attempts + 1
    where id = (select id from invitation_email_codes where invitation_id = ${inv.id} and verified_at is null order by created_at desc limit 1)
    returning *`;
  if (!row || new Date(row.expires_at) < new Date()) throw new AppError("validation", "That code has expired. Send a new code and use the latest email.", { code: "Code expired." });
  if (row.attempts > MAX_ATTEMPTS) throw new AppError("rate_limited", "Too many wrong tries for this code. Send a new code.", { code: "Too many tries." });
  const ok = timingSafeEqual(Buffer.from(row.code_hash, "hex"), Buffer.from(hashCode(inv.id, code), "hex"));
  if (!ok) {
    const left = MAX_ATTEMPTS - row.attempts;
    throw new AppError("validation", left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "That code isn't right. Send a new code to try again.", { code: "Wrong code." });
  }
  const done = await sql()`update invitation_email_codes set verified_at = now() where id = ${row.id} and verified_at is null returning id`;
  if (!done[0]) throw new AppError("conflict", "That code was already used. Reload the page.");
  return { verified: true };
}

export async function invitationEmailVerified(invitationId: string) {
  const [r] = await sql()`select 1 from invitation_email_codes where invitation_id = ${invitationId}
                          and verified_at > now() - make_interval(mins => ${VERIFIED_FOR_MINUTES}) limit 1`;
  return Boolean(r);
}
