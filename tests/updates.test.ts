import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { createStartup } from "@/lib/server/domain/startups";
import { dailyNotesForWeek, listJournal, listRevisions, moderateUpdate, saveUpdate, UpdateConflict } from "@/lib/server/domain/updates";
import { addDays, todayIn } from "@/lib/time";
import { account, activeCohort, grant, org } from "./helpers";

async function team() {
  const o = await org();
  const owner = await account(o, { owner: true });
  const a = await account(o, { name: "Ana" });
  const b = await account(o, { name: "Ben" });
  const C = await activeCohort(owner);
  const e = await createStartup(owner, C.id, { name: "Delta", description: "d", contactName: "Ana", contactEmail: a.email });
  await grant(owner, a, "founder", C.id, e);
  await grant(owner, b, "founder", C.id, e);
  return { owner, a, b, C, e, today: todayIn(C.timezone) };
}

describe("team updates (AC08–AC11)", () => {
  it("validates, rejects future dates and unsafe links, and never duplicates", async () => {
    const { a, C, e, today } = await team();
    await expect(saveUpdate(a, C.id, { enrollmentId: e, kind: "daily", reportDate: addDays(today, 1), content: { moved: "x", next: "y" }, lockVersion: null, intent: "draft" })).rejects.toThrow(/future/);
    await expect(saveUpdate(a, C.id, { enrollmentId: e, kind: "daily", reportDate: today, content: { moved: "x", next: "y", link: "javascript:alert(1)" }, lockVersion: null, intent: "draft" })).rejects.toThrow();
    await expect(saveUpdate(a, C.id, { enrollmentId: e, kind: "daily", reportDate: today, content: { moved: "x".repeat(1201), next: "y" }, lockVersion: null, intent: "draft" })).rejects.toThrow();
    await expect(saveUpdate(a, C.id, { enrollmentId: e, kind: "daily", reportDate: today, content: { moved: "x" }, lockVersion: null, intent: "publish" })).rejects.toThrow(/required/);
    // Double-click publish: both resolve, one record.
    const input = { enrollmentId: e, kind: "daily" as const, reportDate: today, content: { moved: "Shipped login", next: "Onboarding" }, lockVersion: null, intent: "publish" as const };
    const results = await Promise.allSettled([saveUpdate(a, C.id, input), saveUpdate(a, C.id, input)]);
    const rows = await sql()`select * from team_updates where enrollment_id = ${e}`;
    expect(rows).toHaveLength(1);
    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    // Retry of an already-applied publish with the stale version is idempotent.
    const again = await saveUpdate(a, C.id, input);
    expect(again.id).toBe(rows[0].id);
    const j = await listJournal(a, C.id, { kind: "daily" });
    expect(j.items.filter((x) => x.id === rows[0].id)).toHaveLength(1);
  });

  it("detects teammate conflicts, keeps published edits published, keeps revisions", async () => {
    const { a, b, C, e, today } = await team();
    const first = await saveUpdate(a, C.id, { enrollmentId: e, kind: "daily", reportDate: today, content: { moved: "v1", next: "n1" }, lockVersion: null, intent: "publish" });
    const byB = await saveUpdate(b, C.id, { enrollmentId: e, kind: "daily", reportDate: today, content: { moved: "v2 by Ben", next: "n1" }, lockVersion: first.lockVersion, intent: "draft" });
    expect(byB.state).toBe("published"); // editing a published post keeps it published
    const err = await saveUpdate(a, C.id, { enrollmentId: e, kind: "daily", reportDate: today, content: { moved: "v2 by Ana", next: "n1" }, lockVersion: first.lockVersion, intent: "draft" }).catch((x) => x);
    expect(err).toBeInstanceOf(UpdateConflict);
    expect((err as UpdateConflict).current.content.moved).toBe("v2 by Ben");
    expect((err as UpdateConflict).current.editor).toBe("Ben");
    const revs = await listRevisions(a, C.id, first.id);
    expect(revs.map((r) => r.content.moved)).toEqual(["v2 by Ben", "v1"]);
    const [u] = await sql()`select edited_after_publish from team_updates where id = ${first.id}`;
    expect(u.edited_after_publish).toBe(true);
    await expect(sql()`update update_revisions set content = '{}' where update_id = ${first.id}`).rejects.toThrow(/immutable/);
  });

  it("weekly summary is separate, requires fields, and sees only its own week's dailies", async () => {
    const { a, C, e, today, owner } = await team();
    const d1 = addDays(C.startDate, 15); // week 3
    const d0 = addDays(C.startDate, 3); // week 1
    await saveUpdate(a, C.id, { enrollmentId: e, kind: "daily", reportDate: d1 <= today ? d1 : today, content: { moved: "wk3", next: "x" }, lockVersion: null, intent: "publish" });
    await saveUpdate(a, C.id, { enrollmentId: e, kind: "daily", reportDate: d0, content: { moved: "wk1 draft" }, lockVersion: null, intent: "draft" });
    await expect(saveUpdate(a, C.id, { enrollmentId: e, kind: "weekly", weekNumber: 3, content: { accomplished: "a" }, lockVersion: null, intent: "publish" })).rejects.toThrow(/required/);
    await expect(saveUpdate(a, C.id, { enrollmentId: e, kind: "weekly", weekNumber: 5, content: {}, lockVersion: null, intent: "draft" })).rejects.toThrow(/hasn't started/);
    const w = await saveUpdate(a, C.id, { enrollmentId: e, kind: "weekly", weekNumber: 3, content: { accomplished: "a", learned: "l", nextCommitments: "n" }, lockVersion: null, intent: "publish" });
    expect(w.state).toBe("published");
    const notes = await dailyNotesForWeek(a, C.id, e, 1);
    expect(notes.map((n) => n.content.moved)).toEqual(["wk1 draft"]);
    expect(notes[0].state).toBe("draft");
    // Moderation hides from the cohort, with an audited reason.
    await expect(moderateUpdate(owner, C.id, w.id, true, "")).rejects.toThrow(/reason/);
    await moderateUpdate(owner, C.id, w.id, true, "Contains private customer data");
    const j = await listJournal(owner, C.id, { kind: "weekly" });
    expect(j.items.find((x) => x.id === w.id)).toBeUndefined();
  });
});
