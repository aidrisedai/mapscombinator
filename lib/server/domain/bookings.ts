import "server-only";
import { z } from "zod";
import { formatTimeRange, localDateOf } from "@/lib/time";
import { optionalHttps, requiredText, text } from "@/lib/validation";
import { audit } from "../audit";
import { assertFounderWritable, cohortAccess, requireCohortAdmin, requireCohortRead, requireFounderOf, type CohortAccess } from "../authz";
import { pgCode, sql, tx, type Db, type Tx } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import { AppError, conflict, forbidden, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { requireMentorManager } from "./mentors";
import { getOrganization } from "./organization";
import { parse } from "./validate";

export type Policy = {
  allowedDurations: number[];
  defaultDuration: number;
  horizonDays: number;
  bufferMinutes: number;
  cancellationWindowMinutes: number;
  activeBookingLimit: number;
  version: number;
};

export async function getPolicy(cohortId: string, db: Db = sql()): Promise<Policy> {
  const [p] = await db`select * from cohort_booking_policies where cohort_id = ${cohortId}`;
  return {
    allowedDurations: p.allowed_durations,
    defaultDuration: p.default_duration,
    horizonDays: p.horizon_days,
    bufferMinutes: p.buffer_minutes,
    cancellationWindowMinutes: p.cancellation_window_minutes,
    activeBookingLimit: p.active_booking_limit,
    version: p.version,
  };
}

const policySchema = z.object({
  allowedDurations: z.string().transform((s, ctx) => {
    const list = [...new Set(s.split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 5 && n <= 240))].sort((a, b) => a - b);
    if (!list.length) ctx.addIssue({ code: "custom", message: "List at least one duration in minutes, e.g. 15, 30." });
    return list;
  }),
  horizonDays: z.coerce.number().int().min(1).max(180),
  cancellationWindowMinutes: z.coerce.number().int().min(0).max(10080),
  activeBookingLimit: z.coerce.number().int().min(1).max(50),
});

/** Policy changes apply to new bookings only; existing bookings keep their snapshot. */
export async function updatePolicy(actor: Account, cohortId: string, input: Record<string, string>) {
  const v = parse(policySchema, input);
  await tx(async (t) => {
    await requireCohortAdmin(actor, cohortId, t);
    await t`update cohort_booking_policies set allowed_durations = ${v.allowedDurations}, default_duration = ${v.allowedDurations[0]},
            horizon_days = ${v.horizonDays}, cancellation_window_minutes = ${v.cancellationWindowMinutes}, active_booking_limit = ${v.activeBookingLimit},
            version = version + 1, updated_by = ${actor.id}, updated_at = now() where cohort_id = ${cohortId}`;
    await audit(t, { actorId: actor.id, action: "booking_policy.update", objectType: "cohort", objectId: cohortId, cohortId, summary: v });
  });
}

// ───────────────────────────── Discovery ───────────────────────────────────

/** Bookable slots for a cohort — computed on the server, rechecked at commit. */
export async function availableSlots(cohortId: string, opts: { mentorId?: string; limit?: number } = {}, db: Db = sql()) {
  const p = await getPolicy(cohortId, db);
  return db`
    select s.id, s.mentor_account_id, s.starts_at, s.ends_at, s.timezone, s.location, s.meeting_url, s.buffer_minutes
    from appointment_slots s
    join appointment_slot_cohorts sc on sc.slot_id = s.id and sc.cohort_id = ${cohortId}
    join cohort_roles r on r.account_id = s.mentor_account_id and r.cohort_id = ${cohortId} and r.role = 'mentor' and r.active
    join accounts a on a.id = s.mentor_account_id and a.state = 'active'
    where s.state = 'offered' and s.starts_at > now() and s.starts_at <= now() + make_interval(days => ${p.horizonDays})
      and extract(epoch from (s.ends_at - s.starts_at))::int / 60 = any(${p.allowedDurations})
      and (${opts.mentorId ?? null}::uuid is null or s.mentor_account_id = ${opts.mentorId ?? null})
      and not exists (select 1 from appointment_bookings b where b.mentor_account_id = s.mentor_account_id and b.state = 'confirmed'
                      and tstzrange(b.blocked_start, b.blocked_end) && tstzrange(s.starts_at, s.ends_at + make_interval(mins => s.buffer_minutes)))
      and not exists (select 1 from office_hours_sessions o where o.host_account_id = s.mentor_account_id and o.state = 'published'
                      and tstzrange(o.starts_at, o.ends_at) && tstzrange(s.starts_at, s.ends_at))
    order by s.starts_at limit ${opts.limit ?? 200}`;
}

export async function listCohortMentors(actor: Account, cohortId: string) {
  const a = await requireCohortRead(actor, cohortId);
  const mentors = await sql()`
    select a.id, a.display_name, p.headline, p.bio, p.expertise, p.interests, p.linkedin_url, p.calendar_url, p.timezone
    from cohort_roles r join accounts a on a.id = r.account_id and a.state = 'active'
    left join mentor_profiles p on p.account_id = a.id
    where r.cohort_id = ${cohortId} and r.role = 'mentor' and r.active order by a.display_name`;
  const slots = await availableSlots(cohortId, { limit: 500 });
  const next = new Map<string, { starts_at: Date; ends_at: Date; timezone: string }[]>();
  for (const s of slots) {
    const list = next.get(s.mentor_account_id) ?? [];
    if (list.length < 3) list.push(s as never);
    next.set(s.mentor_account_id, list);
  }
  return { access: a, mentors: mentors.map((m) => ({ ...m, nextSlots: next.get(m.id) ?? [] })) };
}

export async function getCohortMentor(actor: Account, cohortId: string, mentorId: string) {
  const a = await requireCohortRead(actor, cohortId);
  const [m] = await sql()`
    select a.id, a.display_name, p.headline, p.bio, p.expertise, p.interests, p.linkedin_url, p.calendar_url, p.contact_email, p.phone,
           p.timezone, p.meeting_instructions
    from cohort_roles r join accounts a on a.id = r.account_id left join mentor_profiles p on p.account_id = a.id
    where r.cohort_id = ${cohortId} and r.account_id = ${mentorId} and r.role = 'mentor' and r.active`;
  if (!m) throw notFound("That mentor isn't available in this cohort.");
  const slots = await availableSlots(cohortId, { mentorId });
  return { access: a, mentor: m, slots, policy: await getPolicy(cohortId) };
}

// ───────────────────────────── Booking ─────────────────────────────────────

const bookSchema = z.object({
  topic: requiredText(200, "Topic"),
  helpNeeded: text(2000, "What help you need").default(""),
  link: optionalHttps,
});

export class SlotTaken extends AppError {
  constructor() {
    super("conflict", "Sorry — that time was just booked or is no longer available. Your question is saved below; pick another time.");
  }
}

function policyText(p: { cancellationWindowMinutes: number }) {
  const h = p.cancellationWindowMinutes / 60;
  return p.cancellationWindowMinutes === 0
    ? "You can cancel or reschedule any time before the start."
    : `You can cancel or reschedule until ${Number.isInteger(h) ? `${h} hour${h === 1 ? "" : "s"}` : `${p.cancellationWindowMinutes} minutes`} before the start. After that, contact the program administrator.`;
}

async function lockMentor(t: Tx, mentorId: string) {
  await t`select pg_advisory_xact_lock(hashtext(${"mentor:" + mentorId}))`;
}

/** Re-validate a slot inside the transaction (stale browser lists are not reservations). */
async function lockBookableSlot(t: Tx, a: CohortAccess, slotId: string, policy: Policy) {
  const [slot] = await t`select * from appointment_slots where id = ${slotId} for update`;
  if (!slot) throw new SlotTaken();
  await lockMentor(t, slot.mentor_account_id);
  const ok = await availableSlots(a.cohort.id, { mentorId: slot.mentor_account_id, limit: 1000 }, t);
  if (!ok.some((s) => s.id === slotId)) throw new SlotTaken();
  const minutes = (new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) / 60000;
  if (!policy.allowedDurations.includes(minutes)) throw new SlotTaken();
  return slot;
}

async function insertBooking(t: Tx, slot: Record<string, unknown>, a: CohortAccess, enrollmentId: string, actor: Account, v: z.infer<typeof bookSchema>, key: string, policy: Policy, replaces: string | null) {
  const start = new Date(slot.starts_at as string);
  const end = new Date(slot.ends_at as string);
  const blockedEnd = new Date(end.getTime() + (slot.buffer_minutes as number) * 60_000);
  try {
    const [b] = await t`
      insert into appointment_bookings (slot_id, cohort_id, enrollment_id, mentor_account_id, booked_by, topic, help_needed, link,
        idempotency_key, starts_at, ends_at, buffer_minutes, blocked_start, blocked_end, policy_snapshot, replaces_booking_id)
      values (${slot.id as string}, ${a.cohort.id}, ${enrollmentId}, ${slot.mentor_account_id as string}, ${actor.id}, ${v.topic}, ${v.helpNeeded}, ${v.link},
        ${key}, ${start}, ${end}, ${slot.buffer_minutes as number}, ${start}, ${blockedEnd}, ${t.json({ ...policy } as never)}, ${replaces})
      returning *`;
    return b;
  } catch (err) {
    const code = pgCode(err);
    if (code === "23P01") {
      const c = (err as { constraint_name?: string }).constraint_name;
      if (c === "appointment_bookings_startup_no_overlap") throw conflict("Your team already has an appointment at an overlapping time. Choose a different time.");
      throw new SlotTaken();
    }
    if (code === "23505" && (err as { constraint_name?: string }).constraint_name === "appointment_bookings_one_per_slot") throw new SlotTaken();
    throw err;
  }
}

async function bookingEmails(t: Tx, kind: "booking_confirmed" | "booking_cancelled" | "booking_rescheduled", bookingId: string, actor: Account, extra: Record<string, string | null> = {}) {
  const [b] = await t`
    select b.*, s.timezone, s.location, s.meeting_url, m.display_name as mentor_name, m.email as mentor_email, p.meeting_url as profile_url,
           f.email as founder_email, f.id as founder_id, st.name as startup, c.name as cohort, c.support_email
    from appointment_bookings b join appointment_slots s on s.id = b.slot_id
    join accounts m on m.id = b.mentor_account_id left join mentor_profiles p on p.account_id = m.id
    join accounts f on f.id = b.booked_by join enrollments e on e.id = b.enrollment_id join startups st on st.id = e.startup_id
    join cohorts c on c.id = b.cohort_id where b.id = ${bookingId}`;
  const org = (await getOrganization(t, actor.organizationId))!;
  const where = [b.meeting_url ?? b.profile_url, b.location].filter(Boolean).join(" · ") || "Details from your mentor";
  const payload = {
    org: org.name,
    support: b.support_email ?? org.supportEmail,
    replyTo: b.support_email ?? org.supportEmail,
    mentor: b.mentor_name,
    startup: b.startup,
    when: formatTimeRange(b.starts_at, b.ends_at, b.timezone),
    duration: `${Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000)} minutes`,
    where,
    topic: b.topic,
    policy: policyText({ cancellationWindowMinutes: b.policy_snapshot.cancellationWindowMinutes }),
    actor: actor.displayName,
    url: kind === "booking_cancelled" ? `${env().APP_URL}/app/cohorts/${b.cohort_id}/office-hours?tab=mentors` : `${env().APP_URL}/app/appointments/${bookingId}`,
    ...extra,
  };
  // Founder who booked + mentor. Cancellation notices may reach people whose
  // access was just revoked — they carry no access tokens.
  const recipients = [
    { to: b.founder_email as string, id: b.founder_id as string },
    { to: b.mentor_email as string, id: b.mentor_account_id as string },
  ];
  for (const r of recipients) {
    await enqueueEmail(t, {
      eventType: kind,
      template: kind,
      to: r.to,
      recipientAccountId: r.id,
      cohortId: b.cohort_id,
      authorizedBy: actor.id,
      payload,
      related: { type: "booking", id: bookingId },
      idempotencyKey: `${kind}:${bookingId}:${r.id}`,
    });
  }
}

/**
 * Book a slot. Idempotent per key; atomic: reservation, history, audit and
 * outbox commit together. Concurrency is resolved by DB constraints.
 */
export async function bookSlot(actor: Account, cohortId: string, input: { enrollmentId: string; slotId: string; idempotencyKey: string } & Record<string, string>) {
  const v = parse(bookSchema, input);
  if (!/^[A-Za-z0-9-]{16,80}$/.test(input.idempotencyKey ?? "")) throw invalid("Please reload the page and try again.");
  const { access } = await requireFounderOf(actor, cohortId, input.enrollmentId);
  assertFounderWritable(access);
  const key = `book:${actor.id}:${input.idempotencyKey}`;
  const [prior] = await sql()`select id from appointment_bookings where idempotency_key = ${key}`;
  if (prior) return prior.id as string;
  try {
    return await tx(async (t) => {
      const policy = await getPolicy(cohortId, t);
      const slot = await lockBookableSlot(t, access, input.slotId, policy);
      const [n] = await t`select count(*)::int as n from appointment_bookings where enrollment_id = ${input.enrollmentId} and state = 'confirmed' and starts_at > now()`;
      if (n.n >= policy.activeBookingLimit)
        throw invalid(`Your team already has ${n.n} upcoming appointment${n.n === 1 ? "" : "s"} (the limit is ${policy.activeBookingLimit}). Cancel one or wait until it's done.`);
      const b = await insertBooking(t, slot, access, input.enrollmentId, actor, v, key, policy, null);
      await t`insert into booking_changes (booking_id, actor_id, event, after) values (${b.id}, ${actor.id}, 'created', ${t.json({ starts_at: b.starts_at, slot: b.slot_id } as never)})`;
      await audit(t, { actorId: actor.id, action: "booking.create", objectType: "booking", objectId: b.id, cohortId });
      await bookingEmails(t, "booking_confirmed", b.id, actor);
      return b.id as string;
    });
  } catch (err) {
    // A concurrent retry with the same key may have committed first.
    if (pgCode(err) === "23505") {
      const [again] = await sql()`select id from appointment_bookings where idempotency_key = ${key}`;
      if (again) return again.id as string;
    }
    throw err;
  }
}

type Role = { founder: boolean; mentor: boolean; admin: boolean; access: CohortAccess };

async function bookingRole(actor: Account, b: Record<string, unknown>, db: Db): Promise<Role> {
  const access = await cohortAccess(actor, b.cohort_id as string, db);
  if (!access) throw notFound("Appointment not found.");
  const founder = access.founderOf.some((f) => f.enrollmentId === b.enrollment_id);
  const mentor = b.mentor_account_id === actor.id;
  if (!founder && !mentor && !access.isAdmin) throw notFound("Appointment not found.");
  return { founder, mentor, admin: access.isAdmin, access };
}

export async function getBooking(actor: Account, bookingId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) throw notFound("Appointment not found.");
  const [b] = await sql()`
    select b.*, s.timezone, s.location, s.meeting_url, m.display_name as mentor_name, p.meeting_url as profile_url, p.meeting_instructions,
           f.display_name as booked_by_name, st.name as startup, c.name as cohort_name, cb.display_name as cancelled_by_name
    from appointment_bookings b join appointment_slots s on s.id = b.slot_id join accounts m on m.id = b.mentor_account_id
    left join mentor_profiles p on p.account_id = m.id join accounts f on f.id = b.booked_by
    join enrollments e on e.id = b.enrollment_id join startups st on st.id = e.startup_id join cohorts c on c.id = b.cohort_id
    left join accounts cb on cb.id = b.cancelled_by
    where b.id = ${bookingId}`;
  if (!b) throw notFound("Appointment not found.");
  const role = await bookingRole(actor, b, sql());
  const history = await sql()`select h.event, h.reason, h.created_at, a.display_name as actor from booking_changes h join accounts a on a.id = h.actor_id
                              where h.booking_id = ${bookingId} order by h.created_at`;
  return { booking: b, role, history };
}

function withinFounderWindow(b: Record<string, unknown>) {
  const windowMin = (b.policy_snapshot as { cancellationWindowMinutes: number }).cancellationWindowMinutes;
  return new Date(b.starts_at as string).getTime() - Date.now() >= windowMin * 60_000;
}

/** Return the slot to availability only if it's still legitimately offered. */
async function releaseSlot(t: Tx, slotId: string) {
  await t`update appointment_slots s set state = 'withdrawn' where s.id = ${slotId} and s.state = 'offered' and (
            s.rule_id is null
            or exists (select 1 from mentor_availability_rules r where r.id = s.rule_id and r.state <> 'active')
            or exists (select 1 from availability_exceptions x where x.mentor_account_id = s.mentor_account_id
                       and x.local_date = (s.starts_at at time zone s.timezone)::date))`;
}

export async function cancelBooking(actor: Account, bookingId: string, reasonInput: string, override = false) {
  const reason = reasonInput.trim().slice(0, 500);
  await tx(async (t) => {
    const [b] = await t`select * from appointment_bookings where id = ${bookingId} for update`;
    if (!b) throw notFound("Appointment not found.");
    const role = await bookingRole(actor, b, t);
    if (b.state !== "confirmed") throw conflict("This appointment isn't active anymore.");
    if (new Date(b.starts_at) < new Date()) throw conflict("This appointment has already started.");
    if ((role.mentor || role.admin) && !role.founder && !reason) throw invalid("Give the founders a reason for cancelling.", { reason: "Required." });
    let usedOverride = false;
    if (role.founder && !role.admin && !role.mentor) {
      if (!role.access.cohort || role.access.cohort.status !== "active") throw forbidden("This cohort is read-only.");
      if (!withinFounderWindow(b)) throw forbidden("It's too close to the start time to cancel here. Please contact the program administrator.");
    } else if (role.admin && !role.mentor && role.founder === false && !withinFounderWindow(b)) {
      usedOverride = true;
    }
    if (override && !role.admin) throw forbidden();
    await t`update appointment_bookings set state = 'cancelled', cancellation_reason = ${reason || null}, cancelled_by = ${actor.id}, cancelled_at = now(), updated_at = now() where id = ${bookingId}`;
    await t`insert into booking_changes (booking_id, actor_id, event, reason, before) values (${bookingId}, ${actor.id}, ${usedOverride || override ? "cancelled_override" : "cancelled"}, ${reason || null}, ${t.json({ state: "confirmed" } as never)})`;
    await releaseSlot(t, b.slot_id);
    await audit(t, { actorId: actor.id, action: usedOverride || override ? "booking.cancel_override" : "booking.cancel", objectType: "booking", objectId: bookingId, cohortId: b.cohort_id, summary: { reason } });
    await bookingEmails(t, "booking_cancelled", bookingId, actor, { reason: reason || null });
  });
}

/**
 * Reschedule: reserve the new slot and cancel the old one in one
 * transaction. If the new slot can't be secured, nothing changes.
 */
export async function rescheduleBooking(actor: Account, bookingId: string, newSlotId: string, idempotencyKey: string, reasonInput = "") {
  if (!/^[A-Za-z0-9-]{16,80}$/.test(idempotencyKey)) throw invalid("Please reload the page and try again.");
  const key = `resched:${actor.id}:${idempotencyKey}`;
  const [prior] = await sql()`select id from appointment_bookings where idempotency_key = ${key}`;
  if (prior) return prior.id as string;
  return tx(async (t) => {
    const [old] = await t`select * from appointment_bookings where id = ${bookingId} for update`;
    if (!old) throw notFound("Appointment not found.");
    const role = await bookingRole(actor, old, t);
    if (!role.founder && !role.admin) throw forbidden("Mentors can cancel with a reason; founders choose the new time.");
    if (old.state !== "confirmed" || new Date(old.starts_at) < new Date()) throw conflict("Only upcoming confirmed appointments can be rescheduled.");
    const reason = reasonInput.trim().slice(0, 500);
    if (!role.founder && !reason) throw invalid("Record the reason for this change.", { reason: "Required." });
    if (role.founder && !role.admin && !withinFounderWindow(old)) throw forbidden("It's too close to the start time to reschedule here. Please contact the program administrator.");
    await lockMentor(t, old.mentor_account_id);
    // Free the old reservation inside this transaction, then secure the new one.
    await t`update appointment_bookings set state = 'cancelled', cancellation_reason = 'Rescheduled', cancelled_by = ${actor.id}, cancelled_at = now(), updated_at = now() where id = ${bookingId}`;
    const policy = old.policy_snapshot as Policy;
    const slot = await lockBookableSlot(t, role.access, newSlotId, { ...(await getPolicy(old.cohort_id, t)), cancellationWindowMinutes: policy.cancellationWindowMinutes });
    const nb = await insertBooking(t, slot, role.access, old.enrollment_id, actor, { topic: old.topic, helpNeeded: old.help_needed, link: old.link }, key, policy, bookingId);
    await t`update appointment_bookings set replaced_by_booking_id = ${nb.id} where id = ${bookingId}`;
    const previous = formatTimeRange(old.starts_at, old.ends_at, slot.timezone);
    await t`insert into booking_changes (booking_id, actor_id, event, reason, after) values (${bookingId}, ${actor.id}, 'rescheduled_from', ${reason || null}, ${t.json({ to: nb.id } as never)})`;
    await t`insert into booking_changes (booking_id, actor_id, event, reason, before) values (${nb.id}, ${actor.id}, 'rescheduled_to', ${reason || null}, ${t.json({ from: bookingId, starts_at: old.starts_at } as never)})`;
    await releaseSlot(t, old.slot_id);
    await audit(t, { actorId: actor.id, action: "booking.reschedule", objectType: "booking", objectId: nb.id, cohortId: old.cohort_id, summary: { from: bookingId, reason } });
    await bookingEmails(t, "booking_rescheduled", nb.id, actor, { previous });
    return nb.id as string;
  });
}

export async function markOutcome(actor: Account, bookingId: string, outcome: "completed" | "no_show") {
  await tx(async (t) => {
    const [b] = await t`select * from appointment_bookings where id = ${bookingId} for update`;
    if (!b) throw notFound();
    const role = await bookingRole(actor, b, t);
    if (!role.mentor && !role.admin) throw forbidden("Only the mentor or an administrator can record this.");
    if (new Date(b.starts_at) > new Date()) throw conflict("You can record the outcome after the appointment starts.");
    if (!["confirmed", "completed", "no_show"].includes(b.state)) throw conflict("This appointment was cancelled.");
    await t`update appointment_bookings set state = ${outcome}, updated_at = now() where id = ${bookingId}`;
    await t`insert into booking_changes (booking_id, actor_id, event) values (${bookingId}, ${actor.id}, ${outcome})`;
    await audit(t, { actorId: actor.id, action: `booking.${outcome}`, objectType: "booking", objectId: bookingId, cohortId: b.cohort_id });
  });
}

const BOOKING_SELECT = (db: ReturnType<typeof sql>) => db`
  select b.id, b.state, b.starts_at, b.ends_at, b.topic, b.cohort_id, b.enrollment_id, s.timezone, m.display_name as mentor_name,
         st.name as startup, c.name as cohort_name, f.display_name as booked_by_name
  from appointment_bookings b join appointment_slots s on s.id = b.slot_id join accounts m on m.id = b.mentor_account_id
  join enrollments e on e.id = b.enrollment_id join startups st on st.id = e.startup_id join cohorts c on c.id = b.cohort_id
  join accounts f on f.id = b.booked_by`;

export async function teamBookings(actor: Account, cohortId: string, enrollmentId: string, when: "upcoming" | "past") {
  await requireFounderOf(actor, cohortId, enrollmentId);
  const db = sql();
  return when === "upcoming"
    ? db`${BOOKING_SELECT(db)} where b.enrollment_id = ${enrollmentId} and b.state = 'confirmed' and b.ends_at >= now() order by b.starts_at`
    : db`${BOOKING_SELECT(db)} where b.enrollment_id = ${enrollmentId} and (b.ends_at < now() or b.state <> 'confirmed') order by b.starts_at desc limit 50`;
}

export async function mentorBookings(actor: Account, when: "upcoming" | "past") {
  const db = sql();
  // Only cohorts where the mentor role is still active.
  return when === "upcoming"
    ? db`${BOOKING_SELECT(db)} where b.mentor_account_id = ${actor.id} and b.state = 'confirmed' and b.ends_at >= now() order by b.starts_at`
    : db`${BOOKING_SELECT(db)} where b.mentor_account_id = ${actor.id} and (b.ends_at < now() or b.state <> 'confirmed') order by b.starts_at desc limit 100`;
}

export async function cohortBookings(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  const db = sql();
  return db`${BOOKING_SELECT(db)} where b.cohort_id = ${cohortId} order by b.starts_at desc limit 300`;
}

/** Human-readable cancellation policy (same text used in confirmation emails). */
export function cancellationPolicyText(p: { cancellationWindowMinutes: number }) {
  return policyText(p);
}

/**
 * A mentor's appointments for the mentor area. Self: every cohort. On behalf
 * (cohort admin): only cohorts the actor administers where this person mentors.
 */
export async function mentorBookingsFor(actor: Account, mentorId: string, when: "upcoming" | "past") {
  if (mentorId === actor.id) return mentorBookings(actor, when);
  const m = await requireMentorManager(actor, mentorId);
  const ids = [...m.adminCohortIds];
  const db = sql();
  return when === "upcoming"
    ? db`${BOOKING_SELECT(db)} where b.mentor_account_id = ${mentorId} and b.cohort_id = any(${ids}) and b.state = 'confirmed' and b.ends_at >= now() order by b.starts_at`
    : db`${BOOKING_SELECT(db)} where b.mentor_account_id = ${mentorId} and b.cohort_id = any(${ids}) and (b.ends_at < now() or b.state <> 'confirmed') order by b.starts_at desc limit 100`;
}

export { localDateOf };
