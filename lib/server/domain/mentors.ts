import "server-only";
import { z } from "zod";
import { addDays, formatTimeRange, hhmmOf, isIsoDate, isLocalTime, isValidTimezone, localDateOf, minutesOf, resolveLocal, todayIn, weekdayOf } from "@/lib/time";
import { optionalHttps, text } from "@/lib/validation";
import { audit } from "../audit";
import { cohortAccess } from "../authz";
import { pgCode, sql, tx, type Db, type Tx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { parse } from "./validate";

// ───────────────────────────── Access ──────────────────────────────────────

/** Cohorts where accountId is an active mentor. */
export async function mentorCohorts(accountId: string, db: Db = sql()) {
  return db`select c.id, c.name, c.status, c.timezone from cohort_roles r join cohorts c on c.id = r.cohort_id
            where r.account_id = ${accountId} and r.role = 'mentor' and r.active order by c.start_date desc`;
}

/** Actor may manage mentorId's profile/availability: the mentor, or an admin of a cohort they mentor in. */
export async function requireMentorManager(actor: Account, mentorId: string, db: Db = sql()) {
  const cohorts = await mentorCohorts(mentorId, db);
  if (actor.id === mentorId) {
    if (!cohorts.length) throw forbidden("You're not an active mentor in any cohort.");
    return { self: true, cohorts, adminCohortIds: new Set<string>() };
  }
  const adminIds = new Set<string>();
  for (const c of cohorts) {
    const a = await cohortAccess(actor, c.id, db);
    if (a?.isAdmin) adminIds.add(c.id);
  }
  if (!adminIds.size) throw notFound("Mentor not found.");
  return { self: false, cohorts: cohorts.filter((c) => adminIds.has(c.id)), adminCohortIds: adminIds };
}

/** Mentor identity + management scope for the mentor area (self or on behalf). */
export async function getMentorContext(actor: Account, mentorId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(mentorId)) throw notFound("Mentor not found.");
  const m = await requireMentorManager(actor, mentorId);
  const [acc] = await sql()`select id, display_name, email from accounts where id = ${mentorId} and organization_id = ${actor.organizationId}`;
  if (!acc) throw notFound("Mentor not found.");
  const profile = await getMentorProfile(mentorId);
  return {
    ...m,
    mentor: { id: acc.id as string, displayName: acc.display_name as string, email: acc.email as string },
    profile,
  };
}

// ───────────────────────────── Profile ─────────────────────────────────────

const profileSchema = z.object({
  displayName: text(120, "Name").optional(),
  bio: text(1500, "Bio").default(""),
  expertise: z.string().default("").transform((s) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 12).map((x) => x.slice(0, 40))),
  timezone: z.string().refine(isValidTimezone, "Choose a valid timezone."),
  meetingUrl: optionalHttps,
  meetingInstructions: text(1000, "Meeting instructions").default(""),
});

export async function getMentorProfile(mentorId: string) {
  const [p] = await sql()`select p.*, a.display_name, a.email from mentor_profiles p join accounts a on a.id = p.account_id where p.account_id = ${mentorId}`;
  return p ?? null;
}

export async function updateMentorProfile(actor: Account, mentorId: string, input: Record<string, string>) {
  const v = parse(profileSchema, input);
  await tx(async (t) => {
    const m = await requireMentorManager(actor, mentorId, t);
    await t`insert into mentor_profiles (account_id, bio, expertise, timezone, meeting_url, meeting_instructions, updated_by)
            values (${mentorId}, ${v.bio}, ${v.expertise}, ${v.timezone}, ${v.meetingUrl}, ${v.meetingInstructions}, ${actor.id})
            on conflict (account_id) do update set bio = excluded.bio, expertise = excluded.expertise, timezone = excluded.timezone,
              meeting_url = excluded.meeting_url, meeting_instructions = excluded.meeting_instructions, updated_by = excluded.updated_by, updated_at = now()`;
    if (m.self && v.displayName) await t`update accounts set display_name = ${v.displayName} where id = ${mentorId}`;
    await audit(t, { actorId: actor.id, action: "mentor.profile_update", objectType: "account", objectId: mentorId, summary: { onBehalf: !m.self } });
  });
}

// ───────────────────────────── Availability rules ──────────────────────────

const ruleSchema = z
  .object({
    kind: z.enum(["single", "weekly"]),
    timezone: z.string().refine(isValidTimezone, "Choose a valid timezone."),
    startDate: z.string().refine(isIsoDate, "Choose a date."),
    endDate: z.string().optional().default(""),
    weekday: z.coerce.number().int().min(1).max(7).optional(),
    startTime: z.string().refine(isLocalTime, "Choose a start time."),
    endTime: z.string().refine(isLocalTime, "Choose an end time."),
    durationMinutes: z.coerce.number().int().min(5).max(240).default(15),
    bufferMinutes: z.coerce.number().int().min(0).max(120).default(0),
    horizonDays: z.coerce.number().int().min(1).max(180).default(28),
    ambiguousOffset: z.enum(["earlier", "later"]).default("earlier"),
    location: text(300, "Location").default(""),
    meetingUrl: optionalHttps,
    cohortIds: z.array(z.string().uuid()).min(1, "Offer this availability to at least one cohort."),
  })
  .superRefine((v, ctx) => {
    if (minutesOf(v.endTime) <= minutesOf(v.startTime)) ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after the start time." });
    if (minutesOf(v.endTime) - minutesOf(v.startTime) < v.durationMinutes) ctx.addIssue({ code: "custom", path: ["endTime"], message: "The window is shorter than one appointment." });
    if (v.kind === "weekly") {
      if (!isIsoDate(v.endDate)) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Choose an end date for the recurring window." });
      else if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date." });
    }
  });
export type RuleInput = z.input<typeof ruleSchema>;

type Rule = {
  id?: string;
  kind: "single" | "weekly";
  timezone: string;
  startDate: string;
  endDate: string;
  weekday: number | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  bufferMinutes: number;
  horizonDays: number;
  ambiguousOffset: "earlier" | "later";
};

function normalizeRule(v: z.infer<typeof ruleSchema>): Rule {
  return {
    kind: v.kind,
    timezone: v.timezone,
    startDate: v.startDate,
    endDate: v.kind === "single" ? v.startDate : v.endDate,
    weekday: v.kind === "weekly" ? (v.weekday ?? weekdayOf(v.startDate)) : null,
    startTime: v.startTime,
    endTime: v.endTime,
    durationMinutes: v.durationMinutes,
    bufferMinutes: v.bufferMinutes,
    horizonDays: v.horizonDays,
    ambiguousOffset: v.ambiguousOffset,
  };
}

function ruleFromRow(r: Record<string, unknown>): Rule {
  return {
    id: r.id as string,
    kind: r.kind as Rule["kind"],
    timezone: r.timezone as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    weekday: (r.weekday as number) ?? null,
    startTime: (r.start_time as string).slice(0, 5),
    endTime: (r.end_time as string).slice(0, 5),
    durationMinutes: r.duration_minutes as number,
    bufferMinutes: r.buffer_minutes as number,
    horizonDays: r.horizon_days as number,
    ambiguousOffset: r.ambiguous_offset as Rule["ambiguousOffset"],
  };
}

export type PlannedSlot = { startsAt: Date; endsAt: Date; localDate: string; localTime: string };
type Exception = { local_date: string; kind: "unavailable" | "replacement"; start_time: string | null; end_time: string | null };

/**
 * Generate slots for a rule within its date range and booking horizon.
 * Nonexistent local times (DST gap) are skipped and reported; ambiguous
 * times use the rule's explicit offset choice.
 */
export function planSlots(rule: Rule, exceptions: Exception[], now = new Date()): { slots: PlannedSlot[]; skipped: string[] } {
  const today = todayIn(rule.timezone, now);
  const from = rule.startDate > today ? rule.startDate : today;
  const horizonEnd = addDays(today, rule.horizonDays);
  const to = rule.endDate < horizonEnd ? rule.endDate : horizonEnd;
  const slots: PlannedSlot[] = [];
  const skipped: string[] = [];
  const stride = rule.durationMinutes + rule.bufferMinutes;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (rule.kind === "weekly" && weekdayOf(d) !== rule.weekday) continue;
    const ex = exceptions.filter((e) => e.local_date === d);
    if (ex.some((e) => e.kind === "unavailable")) continue;
    const repl = ex.find((e) => e.kind === "replacement");
    const winStart = minutesOf(repl ? repl.start_time!.slice(0, 5) : rule.startTime);
    const winEnd = minutesOf(repl ? repl.end_time!.slice(0, 5) : rule.endTime);
    for (let m = winStart; m + rule.durationMinutes <= winEnd; m += stride) {
      const hhmm = hhmmOf(m);
      const r = resolveLocal(d, hhmm, rule.timezone);
      let start: Date | null = null;
      if (r.kind === "ok") start = r.utc;
      else if (r.kind === "ambiguous") start = rule.ambiguousOffset === "earlier" ? r.earlier : r.later;
      if (!start) {
        skipped.push(`${d} ${hhmm} (doesn't exist because clocks spring forward)`);
        continue;
      }
      if (start <= now) continue;
      slots.push({ startsAt: start, endsAt: new Date(start.getTime() + rule.durationMinutes * 60_000), localDate: d, localTime: hhmm });
    }
  }
  return { slots, skipped };
}

async function assertCohortsAllowed(actor: Account, mentorId: string, cohortIds: string[], t: Tx) {
  const m = await requireMentorManager(actor, mentorId, t);
  const allowed = new Set(m.cohorts.map((c) => c.id as string));
  for (const id of cohortIds) if (!allowed.has(id)) throw forbidden("You can only offer availability to cohorts this mentor is assigned to (and that you manage).");
  for (const c of m.cohorts) if (cohortIds.includes(c.id) && (c.status === "completed" || c.status === "archived")) throw invalid(`${c.name} has ended and can't take new appointments.`);
  return m;
}

/** Preview generated slots (no writes). */
export async function previewRule(actor: Account, mentorId: string, input: RuleInput) {
  const v = parse(ruleSchema, input);
  await tx((t) => assertCohortsAllowed(actor, mentorId, v.cohortIds, t));
  const rule = normalizeRule(v);
  const exceptions = (await sql()`select local_date, kind, start_time, end_time from availability_exceptions where mentor_account_id = ${mentorId}`) as unknown as Exception[];
  const { slots, skipped } = planSlots(rule, exceptions);
  const clashes = await overlapping(sql(), mentorId, slots, null);
  const policies = await sql()`select c.name, p.allowed_durations from cohort_booking_policies p join cohorts c on c.id = p.cohort_id where p.cohort_id = any(${v.cohortIds})`;
  const durationWarnings = policies
    .filter((p) => !(p.allowed_durations as number[]).includes(rule.durationMinutes))
    .map((p) => `${p.name} only offers ${(p.allowed_durations as number[]).join("/")}-minute appointments, so these ${rule.durationMinutes}-minute times won't appear there.`);
  return { durationWarnings, slots: slots.map((s) => ({ ...s, label: formatTimeRange(s.startsAt, s.endsAt, rule.timezone), clash: clashes.has(s.startsAt.getTime()) })), skipped, ambiguous: slots.length };
}

/** Planned slots that collide with this mentor's other offers, bookings, or hosted sessions. */
async function overlapping(db: Db, mentorId: string, slots: PlannedSlot[], ruleId: string | null) {
  const clashes = new Set<number>();
  if (!slots.length) return clashes;
  const min = slots[0].startsAt;
  const max = slots[slots.length - 1].endsAt;
  const offered = await db`select starts_at, ends_at from appointment_slots where mentor_account_id = ${mentorId} and state = 'offered'
                           and (${ruleId}::uuid is null or rule_id is distinct from ${ruleId}) and ends_at > ${min} and starts_at < ${max}`;
  const booked = await db`select blocked_start as starts_at, blocked_end as ends_at from appointment_bookings b
                          join appointment_slots s on s.id = b.slot_id
                          where b.mentor_account_id = ${mentorId} and b.state = 'confirmed' and (${ruleId}::uuid is null or s.rule_id is distinct from ${ruleId})
                          and b.blocked_end > ${min} and b.blocked_start < ${max}`;
  const sessions = await db`select starts_at, ends_at from office_hours_sessions where host_account_id = ${mentorId} and state = 'published'
                            and ends_at > ${min} and starts_at < ${max}`;
  const busy = [...offered, ...booked, ...sessions].map((r) => [new Date(r.starts_at).getTime(), new Date(r.ends_at).getTime()]);
  for (const s of slots) {
    const a = s.startsAt.getTime();
    const b = s.endsAt.getTime();
    if (busy.some(([x, y]) => a < y && x < b)) clashes.add(a);
  }
  return clashes;
}

/** Insert/re-offer slots for a rule; idempotent. Returns number of new offers. */
async function materialize(t: Tx, mentorId: string, ruleRow: Record<string, unknown>, cohortIds: string[]) {
  const rule = ruleFromRow(ruleRow);
  const exceptions = (await t`select local_date, kind, start_time, end_time from availability_exceptions where mentor_account_id = ${mentorId}`) as unknown as Exception[];
  const { slots } = planSlots(rule, exceptions);
  const clashes = await overlapping(t, mentorId, slots, rule.id!);
  let created = 0;
  for (const s of slots) {
    if (clashes.has(s.startsAt.getTime())) continue;
    const [row] = await t`
      insert into appointment_slots (mentor_account_id, rule_id, starts_at, ends_at, buffer_minutes, timezone, location, meeting_url)
      values (${mentorId}, ${rule.id!}, ${s.startsAt}, ${s.endsAt}, ${rule.bufferMinutes}, ${rule.timezone}, ${ruleRow.location as string}, ${ruleRow.meeting_url as string})
      on conflict (mentor_account_id, starts_at, ends_at) do update set
        state = 'offered', rule_id = excluded.rule_id, buffer_minutes = excluded.buffer_minutes, location = excluded.location, meeting_url = excluded.meeting_url
        where appointment_slots.state = 'withdrawn'
      returning id, (xmax = 0) as inserted`;
    if (!row) continue; // already offered by this rule
    created++;
    for (const c of cohortIds) await t`insert into appointment_slot_cohorts (slot_id, cohort_id) values (${row.id}, ${c}) on conflict do nothing`;
  }
  // Keep cohort mappings in sync for existing offered slots of this rule.
  await t`delete from appointment_slot_cohorts sc using appointment_slots s where sc.slot_id = s.id and s.rule_id = ${rule.id!} and not (sc.cohort_id = any(${cohortIds}))`;
  for (const c of cohortIds)
    await t`insert into appointment_slot_cohorts (slot_id, cohort_id) select id, ${c} from appointment_slots where rule_id = ${rule.id!} and state = 'offered' on conflict do nothing`;
  return created;
}

/** Withdraw future, unbooked slots of a rule; booked ones are kept as booked. */
async function withdrawUnbooked(t: Tx, ruleId: string, filter?: { localDate: string; timezone: string }) {
  const rows = await t`
    update appointment_slots s set state = 'withdrawn'
    where s.rule_id = ${ruleId} and s.state = 'offered' and s.starts_at > now()
      and not exists (select 1 from appointment_bookings b where b.slot_id = s.id and b.state = 'confirmed')
      and (${filter?.localDate ?? null}::date is null or (s.starts_at at time zone ${filter?.timezone ?? "UTC"})::date = ${filter?.localDate ?? null}::date)
    returning id`;
  return rows.length;
}

async function bookedFuture(t: Db, mentorId: string, ruleId: string | null, localDate?: string, tz?: string) {
  return t`select b.id, b.starts_at, b.ends_at, s.timezone, st.name as startup from appointment_bookings b
           join appointment_slots s on s.id = b.slot_id join enrollments e on e.id = b.enrollment_id join startups st on st.id = e.startup_id
           where b.mentor_account_id = ${mentorId} and b.state = 'confirmed' and b.starts_at > now()
             and (${ruleId}::uuid is null or s.rule_id = ${ruleId})
             and (${localDate ?? null}::date is null or (b.starts_at at time zone ${tz ?? "UTC"})::date = ${localDate ?? null}::date)
           order by b.starts_at`;
}

export async function createRule(actor: Account, mentorId: string, input: RuleInput) {
  const v = parse(ruleSchema, input);
  return tx(async (t) => {
    await assertCohortsAllowed(actor, mentorId, v.cohortIds, t);
    await t`select pg_advisory_xact_lock(hashtext(${"mentor:" + mentorId}))`;
    const rule = normalizeRule(v);
    const exceptions = (await t`select local_date, kind, start_time, end_time from availability_exceptions where mentor_account_id = ${mentorId}`) as unknown as Exception[];
    const { slots } = planSlots(rule, exceptions);
    if (!slots.length) throw invalid("This availability doesn't produce any bookable times in the booking horizon.");
    const clashes = await overlapping(t, mentorId, slots, null);
    if (clashes.size) throw conflict(`${clashes.size} of these times overlap availability, appointments or sessions this mentor already has. Adjust the window so offers don't compete.`);
    const [row] = await t`
      insert into mentor_availability_rules (mentor_account_id, kind, timezone, start_date, end_date, weekday, start_time, end_time,
        duration_minutes, buffer_minutes, horizon_days, ambiguous_offset, location, meeting_url, created_by)
      values (${mentorId}, ${rule.kind}, ${rule.timezone}, ${rule.startDate}, ${rule.endDate}, ${rule.weekday}, ${rule.startTime}, ${rule.endTime},
        ${rule.durationMinutes}, ${rule.bufferMinutes}, ${rule.horizonDays}, ${rule.ambiguousOffset}, ${v.location || null}, ${v.meetingUrl}, ${actor.id})
      returning *`;
    for (const c of v.cohortIds) await t`insert into availability_rule_cohorts (rule_id, cohort_id) values (${row.id}, ${c})`;
    let created: number;
    try {
      created = await materialize(t, mentorId, row, v.cohortIds);
    } catch (err) {
      if (pgCode(err) === "23P01") throw conflict("Some of these times overlap this mentor's existing availability.");
      throw err;
    }
    await audit(t, { actorId: actor.id, action: "availability.create", objectType: "availability_rule", objectId: row.id, summary: { mentor: mentorId, slots: created, cohorts: v.cohortIds } });
    return { ruleId: row.id as string, created };
  });
}

/**
 * Retire a rule: unbooked future slots stop being offered. Confirmed
 * appointments are kept unless the admin/mentor cancels them explicitly.
 */
export async function retireRule(actor: Account, mentorId: string, ruleId: string, acknowledgeBookings: boolean) {
  return tx(async (t) => {
    await requireMentorManager(actor, mentorId, t);
    await t`select pg_advisory_xact_lock(hashtext(${"mentor:" + mentorId}))`;
    const [r] = await t`select * from mentor_availability_rules where id = ${ruleId} and mentor_account_id = ${mentorId} and state = 'active' for update`;
    if (!r) throw notFound("That availability was already removed.");
    const booked = await bookedFuture(t, mentorId, ruleId);
    if (booked.length && !acknowledgeBookings)
      throw conflict(`${booked.length} confirmed appointment(s) use this availability. They will stay booked — confirm to continue, or cancel them first.`);
    const withdrawn = await withdrawUnbooked(t, ruleId);
    await t`update mentor_availability_rules set state = 'retired', version = version + 1, updated_at = now() where id = ${ruleId}`;
    await audit(t, { actorId: actor.id, action: "availability.retire", objectType: "availability_rule", objectId: ruleId, summary: { withdrawn, keptBookings: booked.length } });
    return { withdrawn, keptBookings: booked.length };
  });
}

const exceptionSchema = z.object({
  localDate: z.string().refine(isIsoDate, "Choose a date."),
  kind: z.enum(["unavailable", "replacement"]),
  startTime: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
});

/** Date exception: unavailable day or replacement window. Never silently cancels bookings. */
export async function addException(actor: Account, mentorId: string, input: Record<string, string>, acknowledgeBookings: boolean) {
  const v = parse(exceptionSchema, input);
  if (v.kind === "replacement" && (!isLocalTime(v.startTime) || !isLocalTime(v.endTime) || minutesOf(v.endTime) <= minutesOf(v.startTime)))
    throw invalid("Give the replacement window a valid start and end time.", { endTime: "End must be after start." });
  return tx(async (t) => {
    await requireMentorManager(actor, mentorId, t);
    await t`select pg_advisory_xact_lock(hashtext(${"mentor:" + mentorId}))`;
    const [p] = await t`select timezone from mentor_profiles where account_id = ${mentorId}`;
    const tz = (p?.timezone as string) ?? "America/Los_Angeles";
    const booked = await bookedFuture(t, mentorId, null, v.localDate, tz);
    if (booked.length && !acknowledgeBookings)
      throw conflict(`${booked.length} confirmed appointment(s) are on ${v.localDate}. They stay booked unless you cancel them — confirm to continue.`);
    await t`insert into availability_exceptions (mentor_account_id, local_date, kind, start_time, end_time, created_by)
            values (${mentorId}, ${v.localDate}, ${v.kind}, ${v.kind === "replacement" ? v.startTime : null}, ${v.kind === "replacement" ? v.endTime : null}, ${actor.id})`;
    const rules = await t`select * from mentor_availability_rules where mentor_account_id = ${mentorId} and state = 'active'`;
    let withdrawn = 0;
    for (const r of rules) {
      withdrawn += await withdrawUnbooked(t, r.id, { localDate: v.localDate, timezone: r.timezone });
      const cohorts = (await t`select cohort_id from availability_rule_cohorts where rule_id = ${r.id}`).map((x) => x.cohort_id as string);
      await materialize(t, mentorId, r, cohorts);
    }
    await audit(t, { actorId: actor.id, action: "availability.exception", objectType: "account", objectId: mentorId, summary: { date: v.localDate, kind: v.kind, withdrawn } });
    return { withdrawn, keptBookings: booked.length };
  });
}

export async function listRules(actor: Account, mentorId: string) {
  await requireMentorManager(actor, mentorId);
  const rules = await sql()`
    select r.*, array(select c.name from availability_rule_cohorts rc join cohorts c on c.id = rc.cohort_id where rc.rule_id = r.id) as cohort_names,
      (select count(*)::int from appointment_slots s where s.rule_id = r.id and s.state = 'offered' and s.starts_at > now()) as upcoming_slots
    from mentor_availability_rules r where r.mentor_account_id = ${mentorId} and r.state = 'active' order by r.start_date`;
  const exceptions = await sql()`select * from availability_exceptions where mentor_account_id = ${mentorId} and local_date >= current_date - 1 order by local_date`;
  return { rules, exceptions };
}

/** Worker: extend every active rule's slots as the horizon rolls forward. */
export async function refreshAllSlots() {
  const rules = await sql()`select * from mentor_availability_rules where state = 'active' and end_date >= current_date - 1`;
  let created = 0;
  for (const r of rules) {
    try {
      created += await tx(async (t) => {
        await t`select pg_advisory_xact_lock(hashtext(${"mentor:" + r.mentor_account_id}))`;
        const cohorts = (await t`select rc.cohort_id from availability_rule_cohorts rc join cohort_roles cr on cr.cohort_id = rc.cohort_id
                                 and cr.account_id = ${r.mentor_account_id} and cr.role = 'mentor' and cr.active where rc.rule_id = ${r.id}`).map((x) => x.cohort_id as string);
        return cohorts.length ? materialize(t, r.mentor_account_id, r, cohorts) : 0;
      });
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "slot refresh failed", rule: r.id, err: (err as Error).message }));
    }
  }
  return created;
}

export { localDateOf };
