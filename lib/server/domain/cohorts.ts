import "server-only";
import { z } from "zod";
import { programWeeks, isValidTimezone, isIsoDate } from "@/lib/time";
import { email, requiredText, text } from "@/lib/validation";
import { audit } from "../audit";
import { cohortAccess, mapCohort, requireCohortAdmin, type Cohort, type CohortStatus } from "../authz";
import { sql, tx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { parse } from "./validate";

const settingsSchema = z.object({
  name: requiredText(160, "Name"),
  description: text(2000, "Description").default(""),
  startDate: z.string().refine(isIsoDate, "Choose a Week 1 start date."),
  weekCount: z.coerce.number().int().min(1, "At least 1 week.").max(52, "At most 52 weeks."),
  timezone: z.string().refine(isValidTimezone, "Choose a valid timezone."),
  supportEmail: z.union([z.literal(""), email]).optional().transform((v) => v || null),
});
export type CohortSettingsInput = z.input<typeof settingsSchema>;

export async function createCohort(actor: Account, input: CohortSettingsInput): Promise<Cohort> {
  if (!actor.isOwner) throw forbidden("Only platform owners can create cohorts.");
  const v = parse(settingsSchema, input);
  return tx(async (t) => {
    const [c] = await t`
      insert into cohorts (organization_id, name, description, start_date, week_count, timezone, support_email, created_by)
      values (${actor.organizationId}, ${v.name}, ${v.description}, ${v.startDate}, ${v.weekCount}, ${v.timezone}, ${v.supportEmail}, ${actor.id})
      returning *`;
    for (const w of programWeeks(v.startDate, v.weekCount)) {
      await t`insert into program_weeks (cohort_id, number, start_date, end_date) values (${c.id}, ${w.number}, ${w.startDate}, ${w.endDate})`;
    }
    await t`insert into cohort_booking_policies (cohort_id, updated_by) values (${c.id}, ${actor.id})`;
    await audit(t, { actorId: actor.id, action: "cohort.create", objectType: "cohort", objectId: c.id, cohortId: c.id, summary: { name: v.name } });
    return mapCohort(c);
  });
}

/** True once any team update exists — date structure is then locked. */
export async function cohortStructureLocked(cohortId: string) {
  const [r] = await sql()`select exists (select 1 from team_updates where cohort_id = ${cohortId}) as locked`;
  return r.locked as boolean;
}

export async function updateCohortSettings(actor: Account, cohortId: string, expectedVersion: number, input: CohortSettingsInput) {
  const v = parse(settingsSchema, input);
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    if (a.cohort.status === "archived") throw forbidden("This cohort is archived. Restore it before making changes.");
    const [c] = await t`select * from cohorts where id = ${cohortId} for update`;
    if (c.version !== expectedVersion) throw conflict("Someone else changed these settings. Reload to see the latest version.");
    const structural = c.start_date !== v.startDate || c.week_count !== v.weekCount || c.timezone !== v.timezone;
    if (structural) {
      const [u] = await t`select exists (select 1 from team_updates where cohort_id = ${cohortId}) as locked`;
      if (u.locked)
        throw invalid("Dates, length and timezone are locked because teams have already posted updates. Week titles and content can still be edited.");
      const weeks = programWeeks(v.startDate, v.weekCount);
      // Removing weeks is allowed only when they hold nothing.
      const dropped = await t`
        select w.number from program_weeks w where w.cohort_id = ${cohortId} and w.number > ${v.weekCount}
          and (w.content_state <> 'none'
            or exists (select 1 from week_resources r where r.week_id = w.id)
            or exists (select 1 from office_hours_sessions s where s.week_id = w.id)
            or exists (select 1 from announcements n where n.week_id = w.id))`;
      if (dropped.length) throw invalid(`Week ${dropped[0].number} already has content or sessions, so the cohort can't be shortened below it.`);
      await t`delete from program_weeks where cohort_id = ${cohortId} and number > ${v.weekCount}`;
      for (const w of weeks) {
        await t`insert into program_weeks (cohort_id, number, start_date, end_date) values (${cohortId}, ${w.number}, ${w.startDate}, ${w.endDate})
                on conflict (cohort_id, number) do update set start_date = excluded.start_date, end_date = excluded.end_date, updated_at = now()`;
      }
    }
    const [updated] = await t`
      update cohorts set name = ${v.name}, description = ${v.description}, start_date = ${v.startDate}, week_count = ${v.weekCount},
        timezone = ${v.timezone}, support_email = ${v.supportEmail}, version = version + 1, updated_at = now()
      where id = ${cohortId} returning *`;
    await audit(t, { actorId: actor.id, action: "cohort.update", objectType: "cohort", objectId: cohortId, cohortId, summary: { structural } });
    return mapCohort(updated);
  });
}

const TRANSITIONS: Record<string, { from: CohortStatus[]; to: CohortStatus; ownerOnly: boolean }> = {
  activate: { from: ["draft"], to: "active", ownerOnly: false },
  complete: { from: ["active"], to: "completed", ownerOnly: false },
  archive: { from: ["completed"], to: "archived", ownerOnly: true },
  restore: { from: ["archived"], to: "completed", ownerOnly: true },
  reopen: { from: ["completed"], to: "active", ownerOnly: true },
};

export async function transitionCohort(actor: Account, cohortId: string, action: keyof typeof TRANSITIONS, reason?: string) {
  const rule = TRANSITIONS[action];
  if (!rule) throw invalid("Unknown action.");
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    if (rule.ownerOnly && !actor.isOwner) throw forbidden("Only platform owners can do that.");
    const [c] = await t`select status from cohorts where id = ${cohortId} for update`;
    if (!rule.from.includes(c.status)) throw conflict(`A ${c.status} cohort can't be changed that way.`);
    if (action === "restore" && !reason?.trim()) throw invalid("Give a reason for restoring this cohort.", { reason: "Required." });
    if (action === "activate") {
      const [admins] = await t`select count(*)::int as n from cohort_roles where cohort_id = ${cohortId} and role = 'admin' and active`;
      if (admins.n === 0 && !actor.isOwner) throw invalid("Assign at least one cohort administrator first.");
    }
    await t`update cohorts set status = ${rule.to}, version = version + 1, updated_at = now() where id = ${cohortId}`;
    await audit(t, { actorId: actor.id, action: `cohort.${action}`, objectType: "cohort", objectId: cohortId, cohortId, summary: { from: c.status, to: rule.to, reason: reason ?? null } });
    return a.cohort.id;
  });
}

export async function listWeeks(cohortId: string) {
  return sql()`select w.*, r.title as published_title from program_weeks w
               left join week_content_revisions r on r.id = w.published_revision_id
               where w.cohort_id = ${cohortId} order by w.number`;
}

export async function getCohortForAdmin(actor: Account, cohortId: string) {
  const a = await cohortAccess(actor, cohortId);
  if (!a || !a.isAdmin) throw notFound();
  return a;
}

/** Cohort admins/mentors/viewers for the Members screen. */
export async function listCohortRoles(cohortId: string) {
  return sql()`select r.id, r.role, r.created_at, a.id as account_id, a.display_name, a.email, a.state
               from cohort_roles r join accounts a on a.id = r.account_id
               where r.cohort_id = ${cohortId} and r.active order by r.role, a.display_name`;
}

export async function revokeCohortRole(actor: Account, cohortId: string, roleId: string) {
  return tx(async (t) => {
    await requireCohortAdmin(actor, cohortId, t);
    const [r] = await t`select * from cohort_roles where id = ${roleId} and cohort_id = ${cohortId} and active for update`;
    if (!r) throw notFound("That role was already removed.");
    if (r.role === "admin" && !actor.isOwner) throw forbidden("Only platform owners can remove cohort administrators.");
    if (r.role === "mentor") {
      const future = await t`select id from appointment_bookings where mentor_account_id = ${r.account_id} and cohort_id = ${cohortId}
                             and state = 'confirmed' and starts_at > now() limit 1`;
      if (future.length)
        throw conflict("This mentor still has upcoming appointments in this cohort. Cancel those appointments (with a reason) first, then remove the mentor.");
      // Stop offering their slots to this cohort immediately.
      await t`delete from appointment_slot_cohorts sc using appointment_slots s
              where sc.slot_id = s.id and s.mentor_account_id = ${r.account_id} and sc.cohort_id = ${cohortId}`;
      await t`delete from availability_rule_cohorts rc using mentor_availability_rules m
              where rc.rule_id = m.id and m.mentor_account_id = ${r.account_id} and rc.cohort_id = ${cohortId}`;
    }
    await t`update cohort_roles set active = false, revoked_at = now(), revoked_by = ${actor.id} where id = ${roleId}`;
    await audit(t, { actorId: actor.id, action: "role.revoke", objectType: "cohort_role", objectId: roleId, cohortId, summary: { role: r.role, account: r.account_id } });
  });
}
