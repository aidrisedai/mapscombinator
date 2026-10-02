import "server-only";
import { sql, type Db } from "./db";
import { forbidden, notFound } from "./errors";
import type { Account } from "./session";

export type CohortStatus = "draft" | "active" | "completed" | "archived";

export type Cohort = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  startDate: string;
  weekCount: number;
  timezone: string;
  supportEmail: string | null;
  status: CohortStatus;
  version: number;
};

export type FounderEnrollment = { enrollmentId: string; startupId: string; startupName: string };

export type CohortAccess = {
  cohort: Cohort;
  isOwner: boolean;
  isAdmin: boolean; // owner or assigned cohort admin
  isMentor: boolean;
  isViewer: boolean;
  founderOf: FounderEnrollment[];
  /** Can read published cohort content (journal, weeks, sessions). */
  canRead: boolean;
};

export function mapCohort(r: Record<string, unknown>): Cohort {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    name: r.name as string,
    description: r.description as string,
    startDate: r.start_date as string,
    weekCount: r.week_count as number,
    timezone: r.timezone as string,
    supportEmail: (r.support_email as string) ?? null,
    status: r.status as CohortStatus,
    version: r.version as number,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID.test(s);
}

/** All scope facts for one account in one cohort, from the database. */
export async function cohortAccess(actor: Account, cohortId: string, db: Db = sql()): Promise<CohortAccess | null> {
  if (!isUuid(cohortId)) return null;
  const [c] = await db`select * from cohorts where id = ${cohortId} and organization_id = ${actor.organizationId}`;
  if (!c) return null;
  const roles = await db`select role from cohort_roles where cohort_id = ${cohortId} and account_id = ${actor.id} and active`;
  const founder = await db`
    select e.id as enrollment_id, s.id as startup_id, s.name as startup_name
    from startup_memberships m
    join enrollments e on e.id = m.enrollment_id
    join startups s on s.id = e.startup_id
    where m.account_id = ${actor.id} and m.active and e.cohort_id = ${cohortId} and e.status = 'active'
    order by s.name`;
  const roleSet = new Set(roles.map((r) => r.role as string));
  const isAdmin = actor.isOwner || roleSet.has("admin");
  const isMentor = roleSet.has("mentor");
  const isViewer = roleSet.has("viewer");
  const founderOf = founder.map((f) => ({
    enrollmentId: f.enrollment_id as string,
    startupId: f.startup_id as string,
    startupName: f.startup_name as string,
  }));
  return {
    cohort: mapCohort(c),
    isOwner: actor.isOwner,
    isAdmin,
    isMentor,
    isViewer,
    founderOf,
    canRead: isAdmin || isMentor || isViewer || founderOf.length > 0,
  };
}

/** Cohort readable by actor — otherwise "not found" (no existence oracle). */
export async function requireCohortRead(actor: Account, cohortId: string, db: Db = sql()) {
  const a = await cohortAccess(actor, cohortId, db);
  if (!a || !a.canRead) throw notFound("We couldn't find that cohort, or you don't have access to it.");
  return a;
}

export async function requireCohortAdmin(actor: Account, cohortId: string, db: Db = sql()) {
  const a = await cohortAccess(actor, cohortId, db);
  if (!a || (!a.canRead && !a.isAdmin)) throw notFound("We couldn't find that cohort, or you don't have access to it.");
  if (!a.isAdmin) throw forbidden("Only this cohort's administrators can do that.");
  return a;
}

/** Founder of this specific enrollment, with an active membership. */
export async function requireFounderOf(actor: Account, cohortId: string, enrollmentId: string, db: Db = sql()) {
  const a = await requireCohortRead(actor, cohortId, db);
  const e = a.founderOf.find((f) => f.enrollmentId === enrollmentId);
  if (!e) throw forbidden("Only this startup's founders can do that.");
  return { access: a, enrollment: e };
}

/** Founders write only in active cohorts; completed/archived are read-only. */
export function assertFounderWritable(a: CohortAccess) {
  if (a.cohort.status === "draft")
    throw forbidden("This cohort hasn't started yet. Posting opens when the program is activated.");
  if (a.cohort.status !== "active") throw forbidden("This cohort has ended. Its history is read-only.");
}

/** Admin content edits allowed in draft/active; completed/archived are read-only for content. */
export function assertAdminWritable(a: CohortAccess) {
  if (a.cohort.status === "archived") throw forbidden("This cohort is archived. Restore it before making changes.");
}

/** Can the actor see this enrollment's private records (drafts, bookings, contacts)? */
export function canSeeTeamPrivate(a: CohortAccess, enrollmentId: string) {
  return a.isAdmin || a.founderOf.some((f) => f.enrollmentId === enrollmentId);
}

/** Cohorts the actor can see, for navigation. */
export async function listAccessibleCohorts(actor: Account) {
  const db = sql();
  if (actor.isOwner) {
    const rows = await db`select * from cohorts where organization_id = ${actor.organizationId} order by start_date desc`;
    return rows.map((r) => ({ ...mapCohort(r), relation: ["owner"] as string[] }));
  }
  const rows = await db`
    select c.*, array_agg(distinct x.rel) as relations from cohorts c
    join (
      select cohort_id, role as rel from cohort_roles where account_id = ${actor.id} and active
      union all
      select e.cohort_id, 'founder' from startup_memberships m join enrollments e on e.id = m.enrollment_id
      where m.account_id = ${actor.id} and m.active and e.status = 'active'
    ) x on x.cohort_id = c.id
    group by c.id order by c.start_date desc`;
  return rows.map((r) => ({ ...mapCohort(r), relation: r.relations as string[] }));
}
