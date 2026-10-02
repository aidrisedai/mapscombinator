import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { createStartup } from "@/lib/server/domain/startups";
import { cancelSession, createSessions, getSession, listSessions, publishSessions, updateSession } from "@/lib/server/domain/office-hours";
import { listAnnouncements, publishAnnouncement, saveAnnouncement } from "@/lib/server/domain/announcements";
import { getWeekForReader, publishWeek, saveWeekDraft, unpublishWeek, uploadFileResource, openResource } from "@/lib/server/domain/weeks";
import { addDays, todayIn, weekdayOf } from "@/lib/time";
import { account, activeCohort, grant, org } from "./helpers";

async function world() {
  const o = await org();
  const owner = await account(o, { owner: true });
  const f = await account(o);
  const outsider = await account(o);
  const C = await activeCohort(owner);
  const C2 = await activeCohort(owner, "America/Los_Angeles", "Other");
  const e = await createStartup(owner, C.id, { name: "Echo", description: "e", contactName: "F", contactEmail: f.email });
  await grant(owner, f, "founder", C.id, e);
  await grant(owner, outsider, "viewer", C2.id);
  return { owner, f, outsider, C, C2, e };
}

/** Next Tuesday on/after the given date. */
function nextTuesday(from: string) {
  let d = from;
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}

describe("weekly content (AC13, AC14)", () => {
  it("hides drafts, publishes only to its cohort, keeps revisions, protects files", async () => {
    const { owner, f, outsider, C } = await world();
    await saveWeekDraft(owner, C.id, 3, { title: "Customer discovery", objective: "Talk to 10 users" });
    expect((await getWeekForReader(f, C.id, 3)).content).toBeNull();
    const [q] = await sql()`select count(*)::int as n from email_outbox where cohort_id = ${C.id} and template = 'week_published'`;
    expect(q.n).toBe(0); // saving a draft never emails
    await publishWeek(owner, C.id, 3, { sendEmail: false });
    expect((await getWeekForReader(f, C.id, 3)).content?.title).toBe("Customer discovery");
    await expect(getWeekForReader(outsider, C.id, 3)).rejects.toThrow();
    await saveWeekDraft(owner, C.id, 3, { title: "Customer discovery v2" });
    expect((await getWeekForReader(f, C.id, 3)).content?.title).toBe("Customer discovery"); // published stays until republished
    const { queued } = await publishWeek(owner, C.id, 3, { sendEmail: true });
    expect(queued).toBeGreaterThanOrEqual(1);
    const id = await uploadFileResource(owner, C.id, 3, { name: "slides.pdf", bytes: Buffer.from("%PDF-1.7 test") }, "Slides");
    expect((await openResource(f, id, "auto")).download).toBe(false);
    await expect(openResource(outsider, id)).rejects.toThrow();
    await unpublishWeek(owner, C.id, 3);
    expect((await getWeekForReader(f, C.id, 3)).content).toBeNull();
    await expect(openResource(f, id)).rejects.toThrow(); // files follow week visibility
    await expect(uploadFileResource(owner, C.id, 3, { name: "evil.exe", bytes: Buffer.from("MZ") }, "x")).rejects.toThrow(/Only PDF/);
  });
});

describe("office hours (AC15–AC17)", () => {
  it("weekly series keeps local time across DST; single edits and future edits are scoped", async () => {
    const { owner, f, C } = await world();
    const first = nextTuesday(addDays(todayIn(C.timezone), 14) < "2026-10-27" ? "2026-10-27" : addDays(todayIn(C.timezone), 1));
    const { ids } = await createSessions(owner, C.id, { title: "Founder office hours", hostName: "Program team", mode: "online", meetingUrl: "https://meet.example.org/oh", date: first, startTime: "17:00", durationMinutes: "60", repeatWeekly: "on", occurrences: "3" });
    expect(ids).toHaveLength(3);
    const rows = await sql()`select starts_at from office_hours_sessions where id = any(${ids}) order by starts_at`;
    const localHours = rows.map((r) => new Date(r.starts_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }));
    expect(new Set(localHours)).toEqual(new Set(["17"]));
    // Drafts are invisible to founders and send nothing.
    expect((await listSessions(f, C.id, { when: "upcoming" })).sessions).toHaveLength(0);
    await publishSessions(owner, C.id, ids[0], { wholeSeries: true, sendEmail: true });
    expect((await listSessions(f, C.id, { when: "upcoming" })).sessions).toHaveLength(3);
    const [emails] = await sql()`select count(*)::int as n from email_outbox where template = 'session_published' and related_id = any(${ids})`;
    expect(emails.n).toBe(3); // one founder × 3 sessions
    // Edit only the second occurrence.
    const s2 = await getSession(owner, C.id, ids[1]);
    await updateSession(owner, C.id, ids[1], { title: "Special edition", hostName: "Program team", mode: "online", meetingUrl: "https://meet.example.org/oh", date: s2.localDate, startTime: "18:00", durationMinutes: "60" }, { scope: "this", sendEmail: false });
    const after = await sql()`select title from office_hours_sessions where id = any(${ids}) order by starts_at`;
    expect(after.map((r) => r.title)).toEqual(["Founder office hours", "Special edition", "Founder office hours"]);
    // This-and-future from the 2nd: 1st untouched.
    await updateSession(owner, C.id, ids[1], { title: "Renamed", hostName: "Program team", mode: "online", meetingUrl: "https://meet.example.org/oh", date: s2.localDate, startTime: "17:30", durationMinutes: "45" }, { scope: "future", sendEmail: true });
    const after2 = await sql()`select title from office_hours_sessions where id = any(${ids}) order by starts_at`;
    expect(after2.map((r) => r.title)).toEqual(["Founder office hours", "Renamed", "Renamed"]);
    // Cancel one: stays visible as cancelled, history retained.
    await cancelSession(owner, C.id, ids[2], { scope: "this", reason: "Holiday", sendEmail: true });
    const visible = (await listSessions(f, C.id, { when: "upcoming" })).sessions;
    expect(visible.find((s) => s.id === ids[2])?.state).toBe("cancelled");
    expect((await getSession(owner, C.id, ids[2])).history.length).toBeGreaterThan(1);
  });

  it("announcement drafts send nothing; email only when explicitly chosen", async () => {
    const { owner, f, C } = await world();
    const id = await saveAnnouncement(owner, C.id, null, { title: "Demo day", body: "Save the date", pinned: "on" });
    expect((await listAnnouncements(f, C.id)).announcements).toHaveLength(0);
    await publishAnnouncement(owner, C.id, id, { sendEmail: false });
    const [n0] = await sql()`select count(*)::int as n from email_outbox where related_id = ${id}`;
    expect(n0.n).toBe(0);
    expect((await listAnnouncements(f, C.id)).announcements[0].pinned).toBe(true);
    await publishAnnouncement(owner, C.id, id, { sendEmail: true });
    const [n1] = await sql()`select count(*)::int as n from email_outbox where related_id = ${id}`;
    expect(n1.n).toBe(1);
  });
});
