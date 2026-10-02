import "server-only";
import { sql, type Db } from "../db";
import { deliver } from "./provider";
import { render, type TemplateName } from "./templates";

export type EnqueueInput = {
  eventType: string;
  template: TemplateName;
  to: string;
  recipientAccountId?: string | null;
  cohortId?: string | null;
  authorizedBy?: string | null;
  payload: Record<string, string | null | undefined>;
  secret?: Record<string, string>;
  related?: { type: string; id: string };
  idempotencyKey: string;
};

/**
 * Enqueue in the caller's transaction so the message exists iff the
 * triggering change commits. Duplicate idempotency keys are ignored.
 */
export async function enqueueEmail(db: Db, m: EnqueueInput): Promise<string | null> {
  const rows = await db`
    insert into email_outbox (event_type, template, recipient_email, recipient_account_id, cohort_id, authorized_by,
      payload, secret_payload, related_type, related_id, idempotency_key)
    values (${m.eventType}, ${m.template}, ${m.to.toLowerCase()}, ${m.recipientAccountId ?? null}, ${m.cohortId ?? null},
      ${m.authorizedBy ?? null}, ${db.json(m.payload as never)}, ${m.secret ? db.json(m.secret as never) : null},
      ${m.related?.type ?? null}, ${m.related?.id ?? null}, ${m.idempotencyKey})
    on conflict (idempotency_key) do nothing
    returning id`;
  return (rows[0]?.id as string) ?? null;
}

const BROADCAST_EVENTS = new Set(["week_published", "announcement", "session_published", "session_changed", "session_cancelled"]);
const MAX_ATTEMPTS = 6;

/** Recipient of a cohort broadcast must still be an active member at send time. */
async function stillHasCohortAccess(accountId: string, cohortId: string) {
  const [r] = await sql()`
    select 1 from accounts a where a.id = ${accountId} and a.state = 'active' and (
      a.is_owner
      or exists (select 1 from cohort_roles r where r.account_id = a.id and r.cohort_id = ${cohortId} and r.active)
      or exists (select 1 from startup_memberships m join enrollments e on e.id = m.enrollment_id
                 where m.account_id = a.id and m.active and e.status = 'active' and e.cohort_id = ${cohortId}))`;
  return Boolean(r);
}

async function syncRelated(db: Db, relatedType: string | null, relatedId: string | null, state: string) {
  if (relatedType !== "invitation" || !relatedId) return;
  const invState = state === "provider_accepted" || state === "delivered" ? "sent" : state === "failed" || state === "bounced" ? "delivery_failed" : null;
  await db`update invitations set delivery_state = ${state},
    state = case when state in ('queued','sent','delivery_failed') and ${invState}::text is not null then ${invState} else state end,
    last_sent_at = case when ${state} = 'provider_accepted' then now() else last_sent_at end
    where id = ${relatedId}`;
}

/** Drain due messages. Safe to run concurrently (SKIP LOCKED). */
export async function processOutbox(limit = 20): Promise<number> {
  const db = sql();
  // Recover messages stranded by a worker crash mid-send. Provider-side
  // idempotency keys prevent a duplicate if the first attempt was accepted.
  await db`update email_outbox set state = 'queued', updated_at = now()
           where state = 'sending' and attempted_at < now() - interval '10 minutes'`;
  const batch = await db`
    update email_outbox set state = 'sending', attempts = attempts + 1, attempted_at = now(), updated_at = now()
    where id in (
      select id from email_outbox where state = 'queued' and next_attempt_at <= now()
      order by next_attempt_at limit ${limit} for update skip locked)
    returning *`;
  for (const m of batch) {
    let state: string;
    let providerId: string | null = null;
    let error: string | null = null;
    let next: Date | null = null;
    if (BROADCAST_EVENTS.has(m.event_type) && m.recipient_account_id && m.cohort_id && !(await stillHasCohortAccess(m.recipient_account_id, m.cohort_id))) {
      state = "suppressed";
      error = "Not sent: recipient no longer has access to this cohort";
    } else {
      const msg = render(m.template as TemplateName, m.payload, m.secret_payload ?? {});
      const r = await deliver(m.recipient_email, msg, `${m.idempotency_key}`.slice(0, 256), m.payload?.replyTo ?? null);
      if (r.kind === "accepted") {
        state = "provider_accepted";
        providerId = r.providerId;
      } else if (r.kind === "suppressed") {
        state = "suppressed";
        error = r.note;
      } else if (r.transient && m.attempts < MAX_ATTEMPTS) {
        state = "queued";
        error = r.error;
        next = new Date(Date.now() + 2 ** m.attempts * 60_000);
      } else {
        state = "failed";
        error = r.error;
      }
    }
    const terminalOk = state === "provider_accepted" || state === "suppressed";
    await db.begin(async (t) => {
      await t`update email_outbox set state = ${state}, provider_message_id = ${providerId}, last_error = ${error},
                next_attempt_at = coalesce(${next}, next_attempt_at), updated_at = now(),
                secret_payload = case when ${terminalOk} then null else secret_payload end
              where id = ${m.id}`;
      await syncRelated(t, m.related_type, m.related_id, state);
    });
  }
  return batch.length;
}

/** Admin retry of a failed message (same idempotency key at the provider). */
export async function retryOutbox(db: Db, id: string, cohortId: string | null) {
  const rows = await db`
    update email_outbox set state = 'queued', next_attempt_at = now(), attempts = 0, last_error = null, updated_at = now()
    where id = ${id} and state = 'failed' and (${cohortId}::uuid is null or cohort_id = ${cohortId})
    returning id, related_type, related_id`;
  if (rows[0]) await syncRelated(db, rows[0].related_type, rows[0].related_id, "queued");
  return rows.length > 0;
}

/** Process a verified provider webhook event idempotently. */
export async function recordDeliveryEvent(eventId: string, type: string, providerMessageId: string | null) {
  const db = sql();
  await db.begin(async (t) => {
    const ins = await t`insert into email_delivery_events (provider_event_id, provider_message_id, event_type)
                        values (${eventId}, ${providerMessageId}, ${type}) on conflict (provider_event_id) do nothing returning id`;
    if (!ins[0] || !providerMessageId) return;
    const map: Record<string, string> = { "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed" };
    const next = map[type];
    if (!next) return;
    // Bounce/complaint outrank delivered; never regress them.
    const rows = await t`update email_outbox set state = ${next}, updated_at = now()
      where provider_message_id = ${providerMessageId}
        and not (state in ('bounced','complained') and ${next} = 'delivered')
      returning related_type, related_id`;
    for (const r of rows) await syncRelated(t, r.related_type, r.related_id, next);
  });
}
