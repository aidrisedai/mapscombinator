import "server-only";
import { z } from "zod";
import { email, optionalHttps, requiredText } from "@/lib/validation";
import { audit } from "../audit";
import { assertAdminWritable, canSeeTeamPrivate, isUuid, requireCohortAdmin, requireCohortRead } from "../authz";
import { sql, tx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { parse } from "./validate";

const cofounder = z.object({ name: requiredText(120, "Name"), email });

const startupSchema = z.object({
  name: requiredText(120, "Startup name"),
  description: requiredText(500, "Short description"),
  website: optionalHttps,
  contactName: requiredText(120, "Primary contact name"),
  contactEmail: email,
  cofounders: z.array(cofounder).max(10).default([]),
});
export type StartupInput = z.input<typeof startupSchema>;

/**
 * Creates the underlying startup and its enrollment in this cohort. A
 * returning startup (existingStartupId) gets a new, separate enrollment.
 */
export async function createStartup(actor: Account, cohortId: string, input: StartupInput, existingStartupId?: string) {
  const v = parse(startupSchema, input);
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    let startupId = existingStartupId;
    if (startupId) {
      const [s] = await t`select id from startups where id = ${startupId} and organization_id = ${actor.organizationId}`;
      if (!s) throw notFound("Startup not found.");
      const [dupe] = await t`select 1 from enrollments where startup_id = ${startupId} and cohort_id = ${cohortId}`;
      if (dupe) throw conflict("This startup is already enrolled in this cohort.");
    } else {
      const [s] = await t`insert into startups (organization_id, name, description, website)
                          values (${actor.organizationId}, ${v.name}, ${v.description}, ${v.website}) returning id`;
      startupId = s.id as string;
    }
    const [e] = await t`insert into enrollments (startup_id, cohort_id, contact_name, contact_email)
                        values (${startupId}, ${cohortId}, ${v.contactName}, ${v.contactEmail}) returning id`;
    await t`insert into enrollment_contacts (enrollment_id, name, email, is_primary) values (${e.id}, ${v.contactName}, ${v.contactEmail}, true)`;
    for (const c of v.cofounders) {
      if (c.email === v.contactEmail) continue;
      await t`insert into enrollment_contacts (enrollment_id, name, email) values (${e.id}, ${c.name}, ${c.email}) on conflict do nothing`;
    }
    await audit(t, { actorId: actor.id, action: "startup.create", objectType: "enrollment", objectId: e.id, cohortId, summary: { name: v.name } });
    return e.id as string;
  });
}

const profileSchema = z.object({
  name: requiredText(120, "Startup name"),
  description: requiredText(500, "Short description"),
  website: optionalHttps,
});

/** Founders edit name/description/website; admins also edit contact details. */
export async function updateStartupProfile(actor: Account, cohortId: string, enrollmentId: string, input: Record<string, string>) {
  return tx(async (t) => {
    const a = await requireCohortRead(actor, cohortId, t);
    const isFounder = a.founderOf.some((f) => f.enrollmentId === enrollmentId);
    if (!a.isAdmin && !isFounder) throw forbidden("Only this startup's founders or administrators can edit its profile.");
    if (!a.isAdmin && a.cohort.status !== "active") throw forbidden("This cohort is read-only.");
    const [e] = await t`select * from enrollments where id = ${enrollmentId} and cohort_id = ${cohortId}`;
    if (!e) throw notFound();
    const v = parse(profileSchema, input);
    await t`update startups set name = ${v.name}, description = ${v.description}, website = ${v.website}, updated_at = now() where id = ${e.startup_id}`;
    if (a.isAdmin && input.contactEmail !== undefined) {
      const c = parse(z.object({ contactName: requiredText(120, "Primary contact name"), contactEmail: email }), input);
      // Contact email is administrative data; it never transfers an account.
      await t`update enrollments set contact_name = ${c.contactName}, contact_email = ${c.contactEmail} where id = ${enrollmentId}`;
      await t`update enrollment_contacts set is_primary = false where enrollment_id = ${enrollmentId}`;
      await t`insert into enrollment_contacts (enrollment_id, name, email, is_primary) values (${enrollmentId}, ${c.contactName}, ${c.contactEmail}, true)
              on conflict (enrollment_id, email) do update set name = excluded.name, is_primary = true`;
    }
    await audit(t, { actorId: actor.id, action: "startup.update", objectType: "enrollment", objectId: enrollmentId, cohortId });
  });
}

export async function addContact(actor: Account, cohortId: string, enrollmentId: string, input: { name: string; email: string }) {
  const v = parse(cofounder, input);
  await tx(async (t) => {
    await requireCohortAdmin(actor, cohortId, t);
    const [e] = await t`select 1 from enrollments where id = ${enrollmentId} and cohort_id = ${cohortId}`;
    if (!e) throw notFound();
    await t`insert into enrollment_contacts (enrollment_id, name, email) values (${enrollmentId}, ${v.name}, ${v.email})
            on conflict (enrollment_id, email) do update set name = excluded.name`;
  });
}

/** Removal is immediate and keeps authored records attributed. */
export async function removeMembership(actor: Account, cohortId: string, enrollmentId: string, membershipId: string) {
  await tx(async (t) => {
    await requireCohortAdmin(actor, cohortId, t);
    const rows = await t`update startup_memberships m set active = false, removed_at = now(), removed_by = ${actor.id}
      from enrollments e where m.id = ${membershipId} and m.enrollment_id = e.id and e.id = ${enrollmentId} and e.cohort_id = ${cohortId} and m.active
      returning m.account_id`;
    if (!rows[0]) throw notFound("That membership was already removed.");
    await audit(t, { actorId: actor.id, action: "membership.remove", objectType: "startup_membership", objectId: membershipId, cohortId, summary: { account: rows[0].account_id } });
  });
}

/** Withdraw a startup from the cohort. Upcoming appointments must be resolved first. */
export async function withdrawEnrollment(actor: Account, cohortId: string, enrollmentId: string) {
  await tx(async (t) => {
    await requireCohortAdmin(actor, cohortId, t);
    const future = await t`select id from appointment_bookings where enrollment_id = ${enrollmentId} and state = 'confirmed' and starts_at > now()`;
    if (future.length) throw conflict(`This startup has ${future.length} upcoming appointment(s). Cancel them first so no meeting is left orphaned.`);
    const rows = await t`update enrollments set status = 'withdrawn', left_at = now() where id = ${enrollmentId} and cohort_id = ${cohortId} and status = 'active' returning id`;
    if (!rows[0]) throw notFound();
    await audit(t, { actorId: actor.id, action: "enrollment.withdraw", objectType: "enrollment", objectId: enrollmentId, cohortId });
  });
}

export async function listEnrollments(cohortId: string, includeWithdrawn = false) {
  return sql()`
    select e.id, e.status, e.contact_name, e.contact_email, e.joined_at, s.id as startup_id, s.name, s.description, s.website,
      (select count(*)::int from startup_memberships m where m.enrollment_id = e.id and m.active) as member_count
    from enrollments e join startups s on s.id = e.startup_id
    where e.cohort_id = ${cohortId} and (${includeWithdrawn} or e.status = 'active')
    order by s.name`;
}

/** Shared startup profile; contact details only for team/admins. */
export async function getEnrollment(actor: Account, cohortId: string, enrollmentId: string) {
  const a = await requireCohortRead(actor, cohortId);
  const [e] = await sql()`
    select e.*, s.name, s.description, s.website from enrollments e join startups s on s.id = e.startup_id
    where e.id = ${enrollmentId} and e.cohort_id = ${cohortId}`;
  if (!e) throw notFound("That startup isn't part of this cohort.");
  const priv = canSeeTeamPrivate(a, enrollmentId);
  const members = await sql()`
    select m.id, m.active, m.created_at, a.id as account_id, a.display_name, ${priv ? sql()`a.email` : sql()`null`} as email
    from startup_memberships m join accounts a on a.id = m.account_id
    where m.enrollment_id = ${enrollmentId} and m.active order by a.display_name`;
  return {
    access: a,
    enrollment: {
      id: e.id as string,
      startupId: e.startup_id as string,
      name: e.name as string,
      description: e.description as string,
      website: e.website as string | null,
      status: e.status as string,
      contactName: priv ? (e.contact_name as string) : null,
      contactEmail: priv ? (e.contact_email as string) : null,
    },
    members,
    canSeePrivate: priv,
  };
}

export async function listContacts(cohortId: string, enrollmentId: string) {
  return sql()`select c.* from enrollment_contacts c join enrollments e on e.id = c.enrollment_id
               where c.enrollment_id = ${enrollmentId} and e.cohort_id = ${cohortId} order by c.is_primary desc, c.name`;
}

/** Startups from earlier cohorts that could re-enroll. */
export async function listReturnableStartups(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  // Startup names from other cohorts are visible to platform owners only.
  if (!actor.isOwner) return [];
  return sql()`select s.id, s.name from startups s where s.organization_id = ${actor.organizationId}
               and not exists (select 1 from enrollments e where e.startup_id = s.id and e.cohort_id = ${cohortId}) order by s.name`;
}

export function ensureNotEmpty(v: string, label: string) {
  if (!v.trim()) throw invalid(`${label} is required.`);
}

/** Basic profile of an existing organization startup, for re-enrolling it (owners only). */
export async function getReturnableStartup(actor: Account, cohortId: string, startupId: string) {
  await requireCohortAdmin(actor, cohortId);
  if (!actor.isOwner) throw forbidden("Only platform owners can re-enroll a startup from another cohort.");
  if (!isUuid(startupId)) throw notFound("Startup not found.");
  const [s] = await sql()`select id, name, description, website from startups where id = ${startupId} and organization_id = ${actor.organizationId}`;
  if (!s) throw notFound("Startup not found.");
  return { id: s.id as string, name: s.name as string, description: s.description as string, website: (s.website as string | null) ?? null };
}
