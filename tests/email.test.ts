import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { enqueueEmail, processOutbox, recordDeliveryEvent, retryOutbox } from "@/lib/server/email/outbox";
import { createInvitation } from "@/lib/server/domain/invitations";
import { csvCell } from "@/lib/server/domain/exports";
import { validateUpload } from "@/lib/server/storage";
import { safeHttpsUrl } from "@/lib/validation";
import { render } from "@/lib/server/email/templates";
import { account, activeCohort, org } from "./helpers";

describe("outbox and email (AC18)", () => {
  it("is idempotent, marks dev-log mail as not sent, scrubs secrets, and syncs invitations", async () => {
    const o = await org();
    const owner = await account(o, { owner: true });
    const C = await activeCohort(owner);
    const invId = await createInvitation(owner, { role: "viewer", email: "viewer@example.org", cohortId: C.id });
    const again = await enqueueEmail(sql(), { eventType: "invitation", template: "invitation", to: "viewer@example.org", payload: {}, idempotencyKey: `invitation:${invId}:1` });
    expect(again).toBeNull(); // duplicate key ignored
    while ((await processOutbox(50)) > 0);
    const [m] = await sql()`select * from email_outbox where related_id = ${invId}`;
    expect(m.state).toBe("suppressed"); // EMAIL_PROVIDER=log never counts as sent
    expect(m.secret_payload).toBeNull();
    const [inv] = await sql()`select state, delivery_state from invitations where id = ${invId}`;
    expect(inv).toMatchObject({ state: "queued", delivery_state: "suppressed" });
  });

  it("applies verified provider events once and never regresses a bounce", async () => {
    const o = await org();
    const owner = await account(o, { owner: true });
    const C = await activeCohort(owner);
    const invId = await createInvitation(owner, { role: "viewer", email: "b@example.org", cohortId: C.id });
    await sql()`update email_outbox set state = 'provider_accepted', provider_message_id = 'msg_123' where related_id = ${invId}`;
    await recordDeliveryEvent("evt_1", "email.bounced", "msg_123");
    await recordDeliveryEvent("evt_1", "email.bounced", "msg_123"); // duplicate webhook
    await recordDeliveryEvent("evt_2", "email.delivered", "msg_123"); // late "delivered" doesn't erase bounce
    const [m] = await sql()`select state from email_outbox where provider_message_id = 'msg_123'`;
    expect(m.state).toBe("bounced");
    const [n] = await sql()`select count(*)::int as n from email_delivery_events where provider_event_id = 'evt_1'`;
    expect(n.n).toBe(1);
    const [inv] = await sql()`select state from invitations where id = ${invId}`;
    expect(inv.state).toBe("delivery_failed");
    // Failed messages can be retried by an admin of that cohort only.
    await sql()`update email_outbox set state = 'failed' where provider_message_id = 'msg_123'`;
    const [row] = await sql()`select id from email_outbox where provider_message_id = 'msg_123'`;
    expect(await retryOutbox(sql(), row.id, "00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(await retryOutbox(sql(), row.id, C.id)).toBe(true);
  });

  it("recovers messages stranded mid-send after a worker crash", async () => {
    await sql()`insert into email_outbox (event_type, template, recipient_email, idempotency_key, state, attempted_at, payload)
                values ('announcement', 'announcement', 'x@example.org', 'crash-test', 'sending', now() - interval '20 minutes', '{}')`;
    while ((await processOutbox(50)) > 0);
    const [m] = await sql()`select state from email_outbox where idempotency_key = 'crash-test'`;
    expect(m.state).toBe("suppressed");
  });
});

describe("input safety (AC19)", () => {
  it("rejects unsafe links and escapes templates, CSV and uploads", () => {
    for (const bad of ["javascript:alert(1)", "http://x.com", "https://user:pw@x.com", "data:text/html,hi", "https://localhost"]) expect(safeHttpsUrl(bad).ok).toBe(false);
    expect(safeHttpsUrl("https://example.com/demo").ok).toBe(true);
    const r = render("announcement", { title: "<script>x</script>", body: "<img onerror=1>", url: "https://a.b" });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;img onerror=1&gt;");
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('a"b')).toBe(`"a""b"`);
    expect(validateUpload("x.exe", Buffer.from("MZ"), 1e6).ok).toBe(false);
    expect(validateUpload("x.pdf", Buffer.from("MZ not a pdf"), 1e6).ok).toBe(false);
    expect(validateUpload("x.pdf", Buffer.from("%PDF-1.7 ..."), 1e6).ok).toBe(true);
    expect(validateUpload("x.pdf", Buffer.alloc(2e6, 0x25), 1e6).ok).toBe(false);
    expect(validateUpload("x.pptx", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("ppt/slides vbaProject.bin")]), 1e6).ok).toBe(false);
    expect(validateUpload("x.pptx", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("ppt/slides/slide1.xml")]), 1e6).ok).toBe(true);
  });
});
