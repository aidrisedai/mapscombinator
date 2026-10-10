import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { merge, unknownPlaceholders } from "@/lib/server/email/merge";
import { render } from "@/lib/server/email/templates";
import { createStartup } from "@/lib/server/domain/startups";
import { saveUpdate } from "@/lib/server/domain/updates";
import { createInvitation, previewInvitation, resendInvitation } from "@/lib/server/domain/invitations";
import { listMessages, previewMessage, saveAutoTemplate, sendMessage } from "@/lib/server/domain/emails";
import { todayIn } from "@/lib/time";
import { account, activeCohort, grant, org } from "./helpers";

async function world() {
  const o = await org();
  const owner = await account(o, { owner: true });
  const admin = await account(o, { name: "Ada Admin" });
  const otherAdmin = await account(o, { name: "Other Admin" });
  const fa = await account(o, { name: "Fatima Ali" });
  const mentor = await account(o, { name: "Maya Mentor" });
  const C = await activeCohort(owner, "America/Los_Angeles", "Fall 2026");
  const C2 = await activeCohort(owner, "America/Los_Angeles", "Other");
  await grant(owner, admin, "admin", C.id);
  await grant(owner, otherAdmin, "admin", C2.id);
  await grant(owner, mentor, "mentor", C.id);
  const ea = await createStartup(owner, C.id, { name: "Alpha", description: "a", contactName: "Fatima Ali", contactEmail: fa.email });
  const eb = await createStartup(owner, C.id, { name: "Bravo", description: "b", contactName: "Bo Brave", contactEmail: `bo-${randomUUID().slice(0, 6)}@example.org` });
  await grant(owner, fa, "founder", C.id, ea);
  return { owner, admin, otherAdmin, fa, mentor, C, C2, ea, eb };
}

const outbox = (where: ReturnType<ReturnType<typeof sql>>) => sql()`select * from email_outbox where ${where} order by created_at`;

describe("custom emails", () => {
  it("merges placeholders, flags typos, and escapes HTML", () => {
    expect(merge("Hi {first_name}, welcome to { cohort_name }!", { full_name: "Fatima Ali", cohort_name: "Fall" })).toBe("Hi Fatima, welcome to Fall!");
    expect(merge("Hi {first_name}", {})).toBe("Hi there");
    expect(unknownPlaceholders("Hi {frist_name} {startup_name}")).toEqual(["frist_name"]);
    const r = render("custom", { subject: "S", body: "Hello <script>x</script>\r\n\r\n- one\r\n- see https://example.org/a?b=1&c=2" });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("<li>one</li><li>see");
    expect(r.html).toContain('<a href="https://example.org/a?b=1&amp;c=2"');
  });

  it("the founder invitation is the acceptance email, uses the cohort's wording, and keeps the setup button", async () => {
    const w = await world();
    const email = `new-${randomUUID().slice(0, 6)}@example.org`;
    const std = await previewInvitation(w.admin, { role: "founder", email, name: "Cole Ng", cohortId: w.C.id, enrollmentId: w.eb });
    expect(std.subject).toBe("Congratulations! Bravo is accepted into Fall 2026");
    expect(std.text).toMatch(/Hi Cole,/);
    expect(std.text).toMatch(/Set up your account: /);
    await saveAutoTemplate(w.admin, w.C.id, "acceptance", { subject: "Welcome aboard, {startup_name}", body: "Dear {full_name}, you're in." });
    const id = await createInvitation(w.admin, { role: "founder", email, name: "Cole Ng", cohortId: w.C.id, enrollmentId: w.eb });
    const [m] = await outbox(sql()`related_id = ${id}`);
    const r = render("invitation", m.payload, m.secret_payload);
    expect(r.subject).toBe("Welcome aboard, Bravo");
    expect(r.text).toMatch(/Dear Cole Ng, you're in\./);
    expect(r.text).toMatch(/accept-invitation#/);
    expect(r.text).toMatch(/expires/);
    // Resend picks up the latest wording.
    await saveAutoTemplate(w.admin, w.C.id, "acceptance", { subject: "Updated {cohort_name}", body: "New text" });
    await resendInvitation(w.admin, id);
    const rows = await outbox(sql()`related_id = ${id} and template = 'invitation'`);
    expect(rows[1].payload.customSubject).toBe("Updated Fall 2026");
  });

  it("queues one welcome email when a founder or mentor sets up their account", async () => {
    const w = await world();
    const [f] = await outbox(sql()`event_type = 'welcome' and recipient_email = ${w.fa.email}`);
    expect(f.payload.subject).toBe("Welcome to Fall 2026, Fatima");
    expect(f.payload.url).toContain(`/app/cohorts/${w.C.id}`);
    const [m] = await outbox(sql()`event_type = 'welcome' and recipient_email = ${w.mentor.email}`);
    expect(m.payload.url).toMatch(/\/mentor\/profile$/);
    // Admin/viewer roles don't get one.
    expect(await outbox(sql()`event_type = 'welcome' and recipient_email = ${w.admin.email}`)).toHaveLength(0);
  });

  it("only this cohort's admins can edit templates, and unknown placeholders are rejected", async () => {
    const w = await world();
    const err = await saveAutoTemplate(w.admin, w.C.id, "founder_welcome", { subject: "Hi {firstname}", body: "x" }).catch((e) => e);
    expect(err.fieldErrors?.subject).toMatch(/Unknown placeholder/);
    await expect(saveAutoTemplate(w.otherAdmin, w.C.id, "founder_welcome", { subject: "x", body: "x" })).rejects.toThrow();
    await expect(saveAutoTemplate(w.fa, w.C.id, "founder_welcome", { subject: "x", body: "x" })).rejects.toThrow();
  });

  it("emails startups personally: founders, contact emails for teams without accounts, mentors on request", async () => {
    const w = await world();
    const input = { audience: "all" as const, subject: "Hi {startup_name}", body: "Hello {first_name}", includeMentors: true };
    const p = await previewMessage(w.admin, w.C.id, input);
    expect(p.recipients.map((r) => [r.email, r.startup, r.viaContact, r.kind])).toEqual([
      [w.fa.email, "Alpha", false, "founder"],
      [expect.stringMatching(/^bo-/), "Bravo", true, "founder"],
      [w.mentor.email, "", false, "mentor"],
    ]);
    const key = randomUUID();
    const s1 = await sendMessage(w.admin, w.C.id, { ...input, idempotencyKey: key });
    const s2 = await sendMessage(w.admin, w.C.id, { ...input, idempotencyKey: key });
    expect(s2.id).toBe(s1.id);
    const rows = await outbox(sql()`related_type = 'message' and related_id = ${s1.id}`);
    expect(rows).toHaveLength(3);
    const fa = rows.find((r) => r.recipient_email === w.fa.email)!;
    expect(fa.payload).toMatchObject({ subject: "Hi Alpha", body: "Hello Fatima" });
    expect(fa.payload.url).toContain(w.C.id);
    expect(rows.find((r) => r.recipient_email.startsWith("bo-"))!.payload.url).toBeNull();
    expect((await listMessages(w.admin, w.C.id, { enrollmentId: w.ea })).map((m) => m.id)).toEqual([s1.id]);
    await expect(previewMessage(w.otherAdmin, w.C.id, input)).rejects.toThrow();
  });

  it("targets selected startups or those missing this week's summary", async () => {
    const w = await world();
    const sel = await previewMessage(w.admin, w.C.id, { audience: "selected", enrollmentIds: [w.eb], subject: "s", body: "b" });
    expect(sel.recipients.map((r) => r.startup)).toEqual(["Bravo"]);
    const [c] = await sql()`select start_date from cohorts where id = ${w.C.id}`;
    const week = Math.floor((Date.parse(todayIn("America/Los_Angeles")) - Date.parse(c.start_date)) / (7 * 86400000)) + 1;
    await saveUpdate(w.fa, w.C.id, { enrollmentId: w.ea, kind: "weekly", weekNumber: week, content: { accomplished: "a", learned: "l", nextCommitments: "n" }, lockVersion: null, intent: "publish" });
    const missing = await previewMessage(w.admin, w.C.id, { audience: "missing_weekly", subject: "s", body: "b" });
    expect(missing.recipients.map((r) => r.startup)).toEqual(["Bravo"]);
  });
});
