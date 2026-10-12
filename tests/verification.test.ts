import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { acceptWithNewAccount } from "@/lib/server/domain/accounts";
import { createInvitation, hashToken, newToken, resendInvitation } from "@/lib/server/domain/invitations";
import { createStartup } from "@/lib/server/domain/startups";
import { invitationEmailVerified, sendInvitationCode, verifyInvitationCode } from "@/lib/server/domain/verification";
import { getCohortEmail } from "@/lib/server/domain/emails";
import { account, activeCohort, org } from "./helpers";

const ip = () => `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function invited() {
  const o = await org();
  const owner = await account(o, { owner: true });
  const C = await activeCohort(owner);
  const email = `inv-${randomUUID().slice(0, 6)}@example.org`;
  const e = await createStartup(owner, C.id, { name: "Alpha", description: "a", contactName: "Ana", contactEmail: email });
  const id = await createInvitation(owner, { role: "founder", email, name: "Ana", cohortId: C.id, enrollmentId: e });
  const token = newToken();
  await sql()`update invitations set token_hash = ${hashToken(token)} where id = ${id}`;
  return { owner, C, id, token, email };
}

async function latestCode(invitationId: string) {
  const [m] = await sql()`select id, secret_payload, recipient_email, cohort_id from email_outbox where template = 'verification_code' and related_id = ${invitationId} order by created_at desc limit 1`;
  return { code: m.secret_payload.code as string, to: m.recipient_email as string, outboxId: m.id as string, cohortId: m.cohort_id as string };
}

describe("email code before account setup", () => {
  it("won't create an account until the invited inbox is confirmed with the emailed code", async () => {
    const w = await invited();
    await expect(acceptWithNewAccount(w.token, { displayName: "Ana", password: "correct horse battery", confirm: "correct horse battery" }, ip())).rejects.toThrow(/Confirm your email/);
    const sent = await sendInvitationCode(w.token, ip());
    expect(sent.email).toBe(w.email);
    const { code, to } = await latestCode(w.id);
    expect(to).toBe(w.email);
    expect(code).toMatch(/^\d{6}$/);
    expect(await invitationEmailVerified(w.id)).toBe(false);
    await verifyInvitationCode(w.token, code.slice(0, 3) + " " + code.slice(3), ip());
    expect(await invitationEmailVerified(w.id)).toBe(true);
  });

  it("rejects wrong, stale and over-tried codes, and only the newest code works", async () => {
    const w = await invited();
    await sendInvitationCode(w.token, ip());
    const first = (await latestCode(w.id)).code;
    await sendInvitationCode(w.token, ip());
    const second = (await latestCode(w.id)).code;
    if (first !== second) await expect(verifyInvitationCode(w.token, first, ip())).rejects.toThrow(/isn't right/);
    const wrong = second === "000000" ? "111111" : "000000";
    let lastErr: Error | null = null;
    for (let i = 0; i < 5; i++) lastErr = await verifyInvitationCode(w.token, wrong, ip()).catch((e) => e);
    expect(lastErr?.message).toMatch(/Send a new code/);
    await expect(verifyInvitationCode(w.token, second, ip())).rejects.toThrow(/Too many wrong tries/);
    // Expired code.
    await sendInvitationCode(w.token, ip());
    await sql()`update invitation_email_codes set expires_at = now() - interval '1 minute' where invitation_id = ${w.id}`;
    await expect(verifyInvitationCode(w.token, (await latestCode(w.id)).code, ip())).rejects.toThrow(/expired/);
    expect(await invitationEmailVerified(w.id)).toBe(false);
  });

  it("refuses codes for revoked or replaced links, limits sending, and hides the code from admins", async () => {
    const w = await invited();
    await sendInvitationCode(w.token, ip());
    const { outboxId, cohortId, code } = await latestCode(w.id);
    const view = await getCohortEmail(w.owner, cohortId, outboxId);
    expect(view.rendered.html).not.toContain(code);
    expect(view.rendered.subject).toMatch(/verification code/);
    for (let i = 0; i < 4; i++) await sendInvitationCode(w.token, ip());
    await expect(sendInvitationCode(w.token, ip())).rejects.toThrow(/Too many/);
    await resendInvitation(w.owner, w.id); // rotates the link
    await expect(verifyInvitationCode(w.token, code, ip())).rejects.toThrow(/no longer valid/);
    await expect(sendInvitationCode("not-a-real-token-at-all-xxxx", ip())).rejects.toThrow(/no longer valid/);
  });
});

describe("emails held back by test mode", () => {
  it("re-issues blocked invitations with a fresh link and sends recent blocked emails; codes and tests are skipped", async () => {
    const w = await invited();
    const { blockedByTestMode, resendBlockedByTestMode } = await import("@/lib/server/domain/invitations");
    const note = "Not sent: sandbox mode and recipient is not on the test allowlist";
    await sendInvitationCode(w.token, ip());
    await sql()`update email_outbox set state = 'suppressed', last_error = ${note}, secret_payload = null where related_id = ${w.id}`;
    await sql()`update invitations set delivery_state = 'suppressed' where id = ${w.id}`;
    const [msg] = await sql()`insert into email_outbox (event_type, template, recipient_email, cohort_id, payload, idempotency_key, state, last_error)
                              values ('message', 'custom', 'x@example.org', ${w.C.id}, '{"subject":"s","body":"b"}', ${"t:" + randomUUID()}, 'suppressed', ${note}) returning id`;
    expect(await blockedByTestMode(w.C.id)).toEqual({ invitations: 1, emails: 1 });
    const r = await resendBlockedByTestMode(w.owner, w.C.id);
    expect(r).toMatchObject({ invitations: 1, emails: 1, problems: [] });
    const fresh = await sql()`select state, secret_payload from email_outbox where related_id = ${w.id} and template = 'invitation' order by created_at desc`;
    expect(fresh[0].state).toBe("queued");
    expect(fresh[0].secret_payload.link).toContain("/accept-invitation#");
    const [m] = await sql()`select state from email_outbox where id = ${msg.id}`;
    expect(m.state).toBe("queued");
    const [code] = await sql()`select state from email_outbox where related_id = ${w.id} and template = 'verification_code'`;
    expect(code.state).toBe("suppressed");
    expect(await blockedByTestMode(w.C.id)).toEqual({ invitations: 0, emails: 0 });
  });
});
