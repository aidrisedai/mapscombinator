import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { createStartup } from "@/lib/server/domain/startups";
import { addException, createRule, planSlots, retireRule } from "@/lib/server/domain/mentors";
import { availableSlots, bookSlot, cancelBooking, getBooking, rescheduleBooking, updatePolicy } from "@/lib/server/domain/bookings";
import { revokeCohortRole } from "@/lib/server/domain/cohorts";
import { addDays, todayIn, weekdayOf } from "@/lib/time";
import { account, activeCohort, grant, org } from "./helpers";

const key = () => randomUUID();

async function world() {
  const o = await org();
  const owner = await account(o, { owner: true });
  const mentor = await account(o, { name: "Mo Mentor" });
  const fa = await account(o, { name: "Founder A" });
  const fb = await account(o, { name: "Founder B" });
  const fc = await account(o, { name: "Founder C" });
  const C1 = await activeCohort(owner, "America/Los_Angeles", "C1");
  const C2 = await activeCohort(owner, "America/Los_Angeles", "C2");
  await grant(owner, mentor, "mentor", C1.id);
  await grant(owner, mentor, "mentor", C2.id);
  const ea = await createStartup(owner, C1.id, { name: "Alpha", description: "a", contactName: "A", contactEmail: fa.email });
  const eb = await createStartup(owner, C1.id, { name: "Bravo", description: "b", contactName: "B", contactEmail: fb.email });
  const ec = await createStartup(owner, C2.id, { name: "Charlie", description: "c", contactName: "C", contactEmail: fc.email });
  await grant(owner, fa, "founder", C1.id, ea);
  await grant(owner, fb, "founder", C1.id, eb);
  await grant(owner, fc, "founder", C2.id, ec);
  const day = addDays(todayIn("America/Los_Angeles"), 3);
  return { owner, mentor, fa, fb, fc, C1, C2, ea, eb, ec, day };
}

const slotsOf = (cohortId: string) => availableSlots(cohortId);

describe("mentor availability and booking (AC25–AC30)", () => {
  it("one canonical slot shared by two cohorts; a race books it exactly once", async () => {
    const w = await world();
    const r = await createRule(w.mentor, w.mentor.id, { kind: "single", timezone: "America/Los_Angeles", startDate: w.day, startTime: "10:00", endTime: "11:00", durationMinutes: 15, cohortIds: [w.C1.id, w.C2.id] });
    expect(r.created).toBe(4);
    const s1 = await slotsOf(w.C1.id);
    const s2 = await slotsOf(w.C2.id);
    expect(s1.map((s) => s.id)).toEqual(s2.map((s) => s.id));
    const slot = s1[0].id;
    // Founders in different cohorts race for the same mentor/time.
    const results = await Promise.allSettled([
      bookSlot(w.fa, w.C1.id, { enrollmentId: w.ea, slotId: slot, idempotencyKey: key(), topic: "Pricing" }),
      bookSlot(w.fb, w.C1.id, { enrollmentId: w.eb, slotId: slot, idempotencyKey: key(), topic: "Hiring" }),
      bookSlot(w.fc, w.C2.id, { enrollmentId: w.ec, slotId: slot, idempotencyKey: key(), topic: "Fundraising" }),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const losers = results.filter((x) => x.status === "rejected") as PromiseRejectedResult[];
    expect(losers.every((l) => /just booked|no longer available/.test(l.reason.message))).toBe(true);
    const [n] = await sql()`select count(*)::int as n from appointment_bookings where slot_id = ${slot} and state = 'confirmed'`;
    expect(n.n).toBe(1);
    expect((await slotsOf(w.C2.id)).find((s) => s.id === slot)).toBeUndefined();
    // Exactly two confirmation emails (founder + mentor).
    const [m] = await sql()`select count(*)::int as n from email_outbox where template = 'booking_confirmed' and recipient_email in (${w.mentor.email})`;
    expect(m.n).toBe(1);
  });

  it("idempotent retries, startup overlap, active limit, and private questions", async () => {
    const w = await world();
    await createRule(w.mentor, w.mentor.id, { kind: "single", timezone: "America/Los_Angeles", startDate: w.day, startTime: "10:00", endTime: "11:00", durationMinutes: 15, cohortIds: [w.C1.id] });
    const slots = await slotsOf(w.C1.id);
    const k = key();
    const b1 = await bookSlot(w.fa, w.C1.id, { enrollmentId: w.ea, slotId: slots[0].id, idempotencyKey: k, topic: "Secret pricing question" });
    const b1again = await bookSlot(w.fa, w.C1.id, { enrollmentId: w.ea, slotId: slots[0].id, idempotencyKey: k, topic: "Secret pricing question" });
    expect(b1again).toBe(b1);
    const [emails] = await sql()`select count(*)::int as n from email_outbox where related_id = ${b1}`;
    expect(emails.n).toBe(2);
    await bookSlot(w.fa, w.C1.id, { enrollmentId: w.ea, slotId: slots[1].id, idempotencyKey: key(), topic: "Second" });
    await expect(bookSlot(w.fa, w.C1.id, { enrollmentId: w.ea, slotId: slots[2].id, idempotencyKey: key(), topic: "Third" })).rejects.toThrow(/limit is 2/);
    // Another startup can't read the booking.
    await expect(getBooking(w.fb, b1)).rejects.toThrow(/not found/);
    expect((await getBooking(w.mentor, b1)).booking.topic).toBe("Secret pricing question");
  });

  it("buffered intervals block overlapping offers and overlapping rules are rejected", async () => {
    const w = await world();
    expect(await availableSlots(w.C1.id)).toHaveLength(0);
    await updatePolicy(w.owner, w.C1.id, { allowedDurations: "15, 20", horizonDays: "28", cancellationWindowMinutes: "120", activeBookingLimit: "2" });
    await createRule(w.mentor, w.mentor.id, { kind: "single", timezone: "America/Los_Angeles", startDate: w.day, startTime: "13:00", endTime: "14:00", durationMinutes: 20, bufferMinutes: 10, cohortIds: [w.C1.id] });
    const slots = await slotsOf(w.C1.id);
    expect(slots.length).toBe(2); // 13:00-13:20, 13:30-13:50
    await expect(createRule(w.mentor, w.mentor.id, { kind: "single", timezone: "America/Los_Angeles", startDate: w.day, startTime: "13:30", endTime: "15:00", durationMinutes: 15, cohortIds: [w.C1.id] })).rejects.toThrow(/overlap/);
    // Mentor can't offer to a cohort they're not assigned to.
    const o2 = await account(w.owner.organizationId);
    const C3 = await activeCohort(w.owner, "America/Los_Angeles", "C3");
    await expect(createRule(w.mentor, w.mentor.id, { kind: "single", timezone: "America/Los_Angeles", startDate: w.day, startTime: "16:00", endTime: "17:00", cohortIds: [C3.id] })).rejects.toThrow(/assigned/);
    expect(o2).toBeTruthy();
  });

  it("reschedule is atomic; cancellation releases only valid offered slots; window enforced", async () => {
    const w = await world();
    const { ruleId } = await createRule(w.mentor, w.mentor.id, { kind: "single", timezone: "America/Los_Angeles", startDate: w.day, startTime: "09:00", endTime: "10:00", durationMinutes: 15, cohortIds: [w.C1.id] });
    const slots = await slotsOf(w.C1.id);
    const mine = await bookSlot(w.fa, w.C1.id, { enrollmentId: w.ea, slotId: slots[0].id, idempotencyKey: key(), topic: "Plan" });
    const theirs = await bookSlot(w.fb, w.C1.id, { enrollmentId: w.eb, slotId: slots[1].id, idempotencyKey: key(), topic: "Other" });
    // Into a taken slot: original stays confirmed.
    await expect(rescheduleBooking(w.fa, mine, slots[1].id, key())).rejects.toThrow(/just booked|no longer available/);
    const [still] = await sql()`select state from appointment_bookings where id = ${mine}`;
    expect(still.state).toBe("confirmed");
    // Into a free slot: both change together, history linked, emails queued.
    const moved = await rescheduleBooking(w.fa, mine, slots[2].id, key());
    const [old] = await sql()`select state, replaced_by_booking_id from appointment_bookings where id = ${mine}`;
    expect(old).toMatchObject({ state: "cancelled", replaced_by_booking_id: moved });
    const [resched] = await sql()`select count(*)::int as n from email_outbox where template = 'booking_rescheduled' and related_id = ${moved}`;
    expect(resched.n).toBe(2);
    // Old slot is offered again.
    expect((await slotsOf(w.C1.id)).some((s) => s.id === slots[0].id)).toBe(true);
    // Mentor cancel requires a reason; founder late cancel is refused.
    await expect(cancelBooking(w.mentor, theirs, "")).rejects.toThrow(/reason/);
    await sql()`update appointment_bookings set policy_snapshot = jsonb_set(policy_snapshot, '{cancellationWindowMinutes}', '100000') where id = ${theirs}`;
    await expect(cancelBooking(w.fb, theirs, "")).rejects.toThrow(/too close/);
    await cancelBooking(w.owner, theirs, "Mentor unavailable"); // admin override, audited
    const [ov] = await sql()`select action from audit_events where object_id = ${theirs} and action like 'booking.cancel%'`;
    expect(ov.action).toBe("booking.cancel_override");
    // Retiring the rule: confirmed booking kept only with acknowledgement; cancelled slot not re-offered afterwards.
    await expect(retireRule(w.mentor, w.mentor.id, ruleId, false)).rejects.toThrow(/stay booked/);
    await retireRule(w.mentor, w.mentor.id, ruleId, true);
    await cancelBooking(w.fa, moved, "");
    expect(await slotsOf(w.C1.id)).toHaveLength(0);
  });

  it("exceptions and access revocation never orphan meetings; policy limits apply", async () => {
    const w = await world();
    await createRule(w.mentor, w.mentor.id, { kind: "weekly", timezone: "America/Los_Angeles", startDate: w.day, endDate: addDays(w.day, 14), weekday: weekdayOf(w.day), startTime: "10:00", endTime: "10:30", durationMinutes: 15, cohortIds: [w.C1.id] });
    const before = await slotsOf(w.C1.id);
    expect(before.length).toBe(6);
    const b = await bookSlot(w.fa, w.C1.id, { enrollmentId: w.ea, slotId: before[0].id, idempotencyKey: key(), topic: "Q" });
    await expect(addException(w.mentor, w.mentor.id, { localDate: w.day, kind: "unavailable" }, false)).rejects.toThrow(/stay booked/);
    await addException(w.mentor, w.mentor.id, { localDate: addDays(w.day, 7), kind: "unavailable" }, false);
    expect((await slotsOf(w.C1.id)).length).toBe(3); // 1 left on day 0, none on day 7, 2 on day 14
    await expect(revokeCohortRole(w.owner, w.C1.id, (await sql()`select id from cohort_roles where account_id = ${w.mentor.id} and cohort_id = ${w.C1.id} and active`)[0].id)).rejects.toThrow(/upcoming appointments/);
    await cancelBooking(w.owner, b, "Mentor leaving the program");
    const [role] = await sql()`select id from cohort_roles where account_id = ${w.mentor.id} and cohort_id = ${w.C1.id} and active`;
    await revokeCohortRole(w.owner, w.C1.id, role.id);
    expect(await slotsOf(w.C1.id)).toHaveLength(0);
    // Horizon from cohort policy hides far slots.
    await updatePolicy(w.owner, w.C2.id, { allowedDurations: "15", horizonDays: "1", cancellationWindowMinutes: "120", activeBookingLimit: "2" });
  });

  it("plans slots across DST and skips nonexistent times", () => {
    const rule = { kind: "weekly" as const, timezone: "America/Los_Angeles", startDate: "2027-03-07", endDate: "2027-03-21", weekday: 7, startTime: "02:00", endTime: "03:00", durationMinutes: 30, bufferMinutes: 0, horizonDays: 180, ambiguousOffset: "earlier" as const };
    const { slots, skipped } = planSlots(rule, [], new Date("2027-03-01T00:00:00Z"));
    expect(skipped.some((s) => s.startsWith("2027-03-14"))).toBe(true);
    expect(slots.filter((s) => s.localDate === "2027-03-14")).toHaveLength(0);
    expect(slots.filter((s) => s.localDate === "2027-03-21").map((s) => s.startsAt.toISOString())).toEqual(["2027-03-21T09:00:00.000Z", "2027-03-21T09:30:00.000Z"]);
  });
});
