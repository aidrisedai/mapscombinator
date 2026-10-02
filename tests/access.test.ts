import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { createInvitation, consumeInvitation, hashToken, lookupInvitation, newToken, resendInvitation, revokeInvitation } from "@/lib/server/domain/invitations";
import { createStartup, removeMembership } from "@/lib/server/domain/startups";
import { listJournal, saveUpdate, getUpdate } from "@/lib/server/domain/updates";
import { exportCohortJson } from "@/lib/server/domain/exports";
import { createCohort, updateCohortSettings, transitionCohort } from "@/lib/server/domain/cohorts";
import { tx } from "@/lib/server/db";
import { todayIn } from "@/lib/time";
import { account, activeCohort, grant, org } from "./helpers";

const startup = (n: string, email: string) => ({ name: n, description: `${n} builds things`, contactName: "Pat", contactEmail: email, cofounders: [] });

describe("cohort isolation and roles (AC01, AC02, AC07, AC12, AC20)", () => {
  it("keeps two cohorts with different timezones independent", async () => {
    const o = await org();
    const owner = await account(o, { owner: true });
    const a = await createCohort(owner, { name: "Seattle", startDate: "2026-10-05", weekCount: 12, timezone: "America/Los_Angeles" });
    const b = await createCohort(owner, { name: "NYC", startDate: "2026-11-02", weekCount: 8, timezone: "America/New_York" });
    const wa = await sql()`select number, start_date from program_weeks where cohort_id = ${a.id} order by number`;
    const wb = await sql()`select number, start_date from program_weeks where cohort_id = ${b.id} order by number`;
    expect(wa).toHaveLength(12);
    expect(wb).toHaveLength(8);
    expect(wa[0].start_date).toBe("2026-10-05");
    expect(wb[0].start_date).toBe("2026-11-02");
    // Shortening/moving before any update works; version check enforced.
    await updateCohortSettings(owner, b.id, b.version, { name: "NYC", startDate: "2026-11-09", weekCount: 6, timezone: "America/New_York" });
    await expect(updateCohortSettings(owner, b.id, b.version, { name: "x", startDate: "2026-11-09", weekCount: 6, timezone: "America/New_York" })).rejects.toThrow(/Someone else/);
  });

  it("denies an admin of cohort A everything in cohort B", async () => {
    const o = await org();
    const owner = await account(o, { owner: true });
    const adminA = await account(o);
    const founderB = await account(o);
    const A = await activeCohort(owner, "America/Los_Angeles", "A");
    const B = await activeCohort(owner, "America/New_York", "B");
    await grant(owner, adminA, "admin", A.id);
    const eB = await createStartup(owner, B.id, startup("Beta", founderB.email));
    await grant(owner, founderB, "founder", B.id, eB);
    const u = await saveUpdate(founderB, B.id, { enrollmentId: eB, kind: "daily", reportDate: todayIn(B.timezone), content: { moved: "a", next: "b" }, lockVersion: null, intent: "publish" });

    await expect(listJournal(adminA, B.id, {})).rejects.toThrow(/couldn't find that cohort/);
    await expect(getUpdate(adminA, B.id, u.id)).rejects.toThrow();
    await expect(exportCohortJson(adminA, B.id)).rejects.toThrow();
    await expect(createStartup(adminA, B.id, startup("Evil", "x@example.org"))).rejects.toThrow();
    await expect(createInvitation(adminA, { role: "founder", email: "x@example.org", cohortId: B.id, enrollmentId: eB })).rejects.toThrow();
    // Can't smuggle B's enrollment through A's cohort id either.
    await expect(createInvitation(adminA, { role: "founder", email: "x@example.org", cohortId: A.id, enrollmentId: eB })).rejects.toThrow(/isn't enrolled/);
    // Admin cannot create admins.
    await expect(createInvitation(adminA, { role: "admin", email: "y@example.org", cohortId: A.id })).rejects.toThrow(/Only platform owners/);
    // Filter by another cohort's enrollment returns nothing in own cohort.
    const j = await listJournal(adminA, A.id, { enrollmentId: eB });
    expect(j.items).toHaveLength(0);
  });

  it("founders cannot touch other teams; removal is immediate; viewers can't post", async () => {
    const o = await org();
    const owner = await account(o, { owner: true });
    const f1 = await account(o);
    const f2 = await account(o);
    const viewer = await account(o);
    const C = await activeCohort(owner);
    const e1 = await createStartup(owner, C.id, startup("One", f1.email));
    const e2 = await createStartup(owner, C.id, startup("Two", f2.email));
    await grant(owner, f1, "founder", C.id, e1);
    await grant(owner, f2, "founder", C.id, e2);
    await grant(owner, viewer, "viewer", C.id);
    const today = todayIn(C.timezone);
    await expect(saveUpdate(f1, C.id, { enrollmentId: e2, kind: "daily", reportDate: today, content: { moved: "x", next: "y" }, lockVersion: null, intent: "draft" })).rejects.toThrow(/Only this startup's founders/);
    await expect(saveUpdate(viewer, C.id, { enrollmentId: e1, kind: "daily", reportDate: today, content: {}, lockVersion: null, intent: "draft" })).rejects.toThrow();
    // Draft from team 2 never reaches team 1.
    const d = await saveUpdate(f2, C.id, { enrollmentId: e2, kind: "daily", reportDate: today, content: { moved: "secret" }, lockVersion: null, intent: "draft" });
    const j = await listJournal(f1, C.id, {});
    expect(j.items.find((x) => x.id === d.id)).toBeUndefined();
    expect(j.drafts.find((x) => x.id === d.id)).toBeUndefined();
    await expect(getUpdate(f1, C.id, d.id)).rejects.toThrow();
    // Viewer sees the journal but not drafts.
    expect((await listJournal(viewer, C.id, {})).drafts).toHaveLength(0);
    // Membership removal takes effect on the next operation.
    const [m] = await sql()`select id from startup_memberships where account_id = ${f1.id}`;
    await removeMembership(owner, C.id, e1, m.id);
    await expect(saveUpdate(f1, C.id, { enrollmentId: e1, kind: "daily", reportDate: today, content: { moved: "x", next: "y" }, lockVersion: null, intent: "draft" })).rejects.toThrow();
    await expect(listJournal(f1, C.id, {})).rejects.toThrow();
  });

  it("completed cohorts are read-only for founders and restore needs owner + reason", async () => {
    const o = await org();
    const owner = await account(o, { owner: true });
    const admin = await account(o);
    const f = await account(o);
    const C = await activeCohort(owner);
    await grant(owner, admin, "admin", C.id);
    const e = await createStartup(owner, C.id, startup("Done", f.email));
    await grant(owner, f, "founder", C.id, e);
    await transitionCohort(admin, C.id, "complete");
    await expect(saveUpdate(f, C.id, { enrollmentId: e, kind: "daily", reportDate: todayIn(C.timezone), content: { moved: "x", next: "y" }, lockVersion: null, intent: "draft" })).rejects.toThrow(/ended/);
    await expect(transitionCohort(admin, C.id, "archive")).rejects.toThrow(/owners/);
    await transitionCohort(owner, C.id, "archive");
    await expect(transitionCohort(owner, C.id, "restore")).rejects.toThrow(/reason/);
    await transitionCohort(owner, C.id, "restore", "Reopened for review");
    const [aud] = await sql()`select * from audit_events where cohort_id = ${C.id} and action = 'cohort.restore'`;
    expect(aud.summary.reason).toBe("Reopened for review");
  });
});

describe("invitations (AC03–AC05)", () => {
  it("is single-use, mailbox-bound, rotates on resend, and dies on revoke", async () => {
    const o = await org();
    const owner = await account(o, { owner: true });
    const C = await activeCohort(owner);
    const invitee = await account(o);
    const other = await account(o);
    const e = await createStartup(owner, C.id, startup("Gamma", invitee.email));
    const id = await createInvitation(owner, { role: "founder", email: invitee.email, cohortId: C.id, enrollmentId: e });
    await expect(createInvitation(owner, { role: "founder", email: invitee.email, cohortId: C.id, enrollmentId: e })).rejects.toThrow(/pending invitation/);
    const [ob] = await sql()`select secret_payload from email_outbox where related_id = ${id}`;
    const token1 = (ob.secret_payload.link as string).split("/").pop()!;
    expect((await lookupInvitation(token1))?.status).toBe("open");
    // Looking up (GET) does not consume.
    expect((await lookupInvitation(token1))?.status).toBe("open");
    await resendInvitation(owner, id);
    expect(await lookupInvitation(token1)).toBeNull(); // old link invalid
    const [ob2] = await sql()`select secret_payload from email_outbox where related_id = ${id} order by created_at desc limit 1`;
    const token2 = (ob2.secret_payload.link as string).split("/").pop()!;
    await expect(tx((t) => consumeInvitation(t, token2, other))).rejects.toThrow(/different email/);
    // Concurrent acceptance: exactly one membership.
    await Promise.allSettled([tx((t) => consumeInvitation(t, token2, invitee)), tx((t) => consumeInvitation(t, token2, invitee))]);
    const ms = await sql()`select * from startup_memberships where account_id = ${invitee.id}`;
    expect(ms).toHaveLength(1);
    expect((await lookupInvitation(token2))?.status).toBe("accepted");
    // Revoked links fail.
    const id2 = await createInvitation(owner, { role: "viewer", email: other.email, cohortId: C.id });
    const t3 = newToken();
    await sql()`update invitations set token_hash = ${hashToken(t3)} where id = ${id2}`;
    await revokeInvitation(owner, id2);
    await expect(tx((t) => consumeInvitation(t, t3, other))).rejects.toThrow(/revoked/);
    const [sup] = await sql()`select state from email_outbox where related_id = ${id2}`;
    expect(sup.state).toBe("suppressed");
    // Expired links fail.
    const id3 = await createInvitation(owner, { role: "mentor", email: other.email, cohortId: C.id });
    const t4 = newToken();
    await sql()`update invitations set token_hash = ${hashToken(t4)}, expires_at = now() - interval '1 minute' where id = ${id3}`;
    await expect(tx((t) => consumeInvitation(t, t4, other))).rejects.toThrow(/expired/);
  });
});
