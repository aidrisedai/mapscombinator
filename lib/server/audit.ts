import "server-only";
import type { Db } from "./db";

export async function audit(
  db: Db,
  e: { actorId: string | null; action: string; objectType: string; objectId?: string | null; cohortId?: string | null; summary?: Record<string, unknown> },
) {
  await db`
    insert into audit_events (actor_id, action, object_type, object_id, cohort_id, summary)
    values (${e.actorId}, ${e.action}, ${e.objectType}, ${e.objectId ?? null}, ${e.cohortId ?? null}, ${db.json((e.summary ?? {}) as never)})`;
}
