import "server-only";
import { audit } from "../audit";
import { requireCohortAdmin } from "../authz";
import { sql } from "../db";
import { forbidden } from "../errors";
import type { Account } from "../session";

/** Spreadsheet-safe CSV cell: neutralize formula prefixes, quote always. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  return [columns.map(csvCell).join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\r\n");
}

/** Lossless JSON of everything one cohort owns (authorized admin/owner only). */
export async function exportCohortJson(actor: Account, cohortId: string) {
  const a = await requireCohortAdmin(actor, cohortId);
  const db = sql();
  const data = {
    format: "maps-platform-cohort-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    cohort: (await db`select * from cohorts where id = ${cohortId}`)[0],
    weeks: await db`select * from program_weeks where cohort_id = ${cohortId} order by number`,
    weekRevisions: await db`select r.* from week_content_revisions r join program_weeks w on w.id = r.week_id where w.cohort_id = ${cohortId} order by w.number, r.revision`,
    resources: await db`select id, week_id, kind, label, url, filename, content_type, size_bytes, state, created_at from week_resources where cohort_id = ${cohortId}`,
    startups: await db`select s.*, e.id as enrollment_id, e.status as enrollment_status, e.contact_name, e.contact_email, e.joined_at, e.left_at
                       from enrollments e join startups s on s.id = e.startup_id where e.cohort_id = ${cohortId}`,
    members: await db`select m.enrollment_id, m.active, m.created_at, m.removed_at, a.id as account_id, a.display_name, a.email
                      from startup_memberships m join accounts a on a.id = m.account_id join enrollments e on e.id = m.enrollment_id where e.cohort_id = ${cohortId}`,
    roles: await db`select r.role, r.active, r.created_at, r.revoked_at, a.id as account_id, a.display_name, a.email from cohort_roles r join accounts a on a.id = r.account_id where r.cohort_id = ${cohortId}`,
    updates: await db`select * from team_updates where cohort_id = ${cohortId} order by created_at`,
    updateRevisions: await db`select r.* from update_revisions r join team_updates u on u.id = r.update_id where u.cohort_id = ${cohortId} order by r.update_id, r.revision`,
    sessions: await db`select * from office_hours_sessions where cohort_id = ${cohortId} order by starts_at`,
    announcements: await db`select * from announcements where cohort_id = ${cohortId} order by created_at`,
    bookings: await db`select * from appointment_bookings where cohort_id = ${cohortId} order by starts_at`,
    bookingPolicy: (await db`select * from cohort_booking_policies where cohort_id = ${cohortId}`)[0],
  };
  await audit(db, { actorId: actor.id, action: "export.cohort_json", objectType: "cohort", objectId: cohortId, cohortId });
  return { cohortName: a.cohort.name, data };
}

export async function exportUpdatesCsv(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  const rows = await sql()`
    select s.name as startup, u.kind, u.report_date, u.week_number, u.state, u.first_published_at, u.last_published_at,
      u.content->>'moved' as moved, u.content->>'next' as next, u.content->>'accomplished' as accomplished, u.content->>'learned' as learned,
      u.content->>'nextCommitments' as next_commitments, u.content->>'blockers' as blockers, u.content->>'link' as link,
      ca.display_name as created_by, le.display_name as last_editor, u.hidden_reason
    from team_updates u join enrollments e on e.id = u.enrollment_id join startups s on s.id = e.startup_id
    join accounts ca on ca.id = u.created_by join accounts le on le.id = u.last_editor_id
    where u.cohort_id = ${cohortId} order by s.name, u.week_number, u.report_date nulls last`;
  await audit(sql(), { actorId: actor.id, action: "export.updates_csv", objectType: "cohort", objectId: cohortId, cohortId });
  return toCsv(rows as never, ["startup", "kind", "report_date", "week_number", "state", "first_published_at", "last_published_at", "moved", "next", "accomplished", "learned", "next_commitments", "blockers", "link", "created_by", "last_editor", "hidden_reason"]);
}

export async function exportPlatformJson(actor: Account) {
  if (!actor.isOwner) throw forbidden();
  const cohorts = await sql()`select id from cohorts where organization_id = ${actor.organizationId}`;
  const out = [];
  for (const c of cohorts) out.push((await exportCohortJson(actor, c.id)).data);
  return { format: "maps-platform-export", version: 1, exportedAt: new Date().toISOString(), cohorts: out };
}
