import "server-only";
import type { Db } from "../db";

/**
 * Broadcast audience, resolved at send time: every active account with an
 * active founder membership or cohort role. Owners without a role are not
 * included. One message per recipient; never CC'd.
 */
export async function cohortRecipients(db: Db, cohortId: string): Promise<{ id: string; email: string; displayName: string }[]> {
  const rows = await db`
    select distinct a.id, a.email, a.display_name from accounts a
    where a.state = 'active' and (
      exists (select 1 from cohort_roles r where r.account_id = a.id and r.cohort_id = ${cohortId} and r.active)
      or exists (select 1 from startup_memberships m join enrollments e on e.id = m.enrollment_id
                 where m.account_id = a.id and m.active and e.status = 'active' and e.cohort_id = ${cohortId}))
    order by a.email`;
  return rows.map((r) => ({ id: r.id as string, email: r.email as string, displayName: r.display_name as string }));
}

export async function recipientCount(db: Db, cohortId: string) {
  return (await cohortRecipients(db, cohortId)).length;
}
