import { randomUUID } from "node:crypto";
import { sql, tx } from "@/lib/server/db";
import type { Account } from "@/lib/server/session";
import { createCohort } from "@/lib/server/domain/cohorts";
import { createInvitation, consumeInvitation, newToken, hashToken } from "@/lib/server/domain/invitations";
import { addDays, todayIn } from "@/lib/time";

export async function org() {
  const [o] = await sql()`insert into organizations (name, support_email) values ('Test Org', 'support@example.org') returning id`;
  return o.id as string;
}

export async function account(orgId: string, opts: { owner?: boolean; name?: string } = {}): Promise<Account> {
  const email = `${randomUUID().slice(0, 8)}@example.org`;
  const [a] = await sql()`insert into accounts (organization_id, auth_subject, email, display_name, is_owner)
                          values (${orgId}, ${"test:" + randomUUID()}, ${email}, ${opts.name ?? email}, ${opts.owner ?? false}) returning *`;
  return { id: a.id, organizationId: orgId, email, displayName: a.display_name, isOwner: a.is_owner, state: "active" };
}

/** Active cohort that started 14 days ago (so "today" is in week 3). */
export async function activeCohort(owner: Account, tz = "America/Los_Angeles", name = "Cohort") {
  const c = await createCohort(owner, { name, startDate: addDays(todayIn(tz), -14), weekCount: 12, timezone: tz });
  await sql()`update cohorts set status = 'active' where id = ${c.id}`;
  return { ...c, status: "active" as const };
}

/** Grant access the way production does: invitation → consume. */
export async function grant(owner: Account, who: Account, role: "admin" | "mentor" | "viewer" | "founder", cohortId: string, enrollmentId?: string) {
  const id = await createInvitation(owner, { role, email: who.email, cohortId, enrollmentId: enrollmentId ?? null });
  const token = newToken();
  await sql()`update invitations set token_hash = ${hashToken(token)} where id = ${id}`;
  await tx((t) => consumeInvitation(t, token, who));
  return token;
}
