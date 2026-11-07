import "server-only";
import { randomUUID } from "node:crypto";
import type { Tx } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import type { Account } from "../session";
import { getOrganization } from "./organization";

/**
 * Tell an advisor they were removed from one or more cohorts, and that they
 * can reply if they think it was a mistake. Queued in the removal transaction.
 */
export async function queueAdvisorRemoved(t: Tx, actor: Account, accountId: string, cohortIds: string[]) {
  if (!cohortIds.length) return;
  const [acct] = await t`select email, display_name, state from accounts where id = ${accountId}`;
  if (!acct || acct.state !== "active") return;
  const cohorts = await t`select id, name, support_email from cohorts where id = any(${cohortIds}) order by name`;
  const [left] = await t`select count(*)::int as n from cohort_roles where account_id = ${accountId} and active`;
  const org = (await getOrganization(t, actor.organizationId))!;
  const support = (cohorts.find((c) => c.support_email)?.support_email as string | undefined) ?? org.supportEmail;
  await enqueueEmail(t, {
    eventType: "advisor_removed",
    template: "advisor_removed",
    to: acct.email,
    recipientAccountId: accountId,
    cohortId: cohorts.length === 1 ? (cohorts[0].id as string) : null,
    authorizedBy: actor.id,
    payload: {
      org: org.name,
      support,
      replyTo: support,
      name: acct.display_name,
      cohorts: cohorts.map((c) => c.name as string).join(", "),
      count: String(cohorts.length),
      stillActive: (left.n as number) > 0 ? "yes" : "",
      url: (left.n as number) > 0 ? `${env().APP_URL}/app` : "",
    },
    related: { type: "account", id: accountId },
    idempotencyKey: `advisor_removed:${accountId}:${randomUUID()}`,
  });
}
