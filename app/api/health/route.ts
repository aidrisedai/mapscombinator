import { NextResponse } from "next/server";
import { sql } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Liveness + database reachability + outbox backlog (no secrets, no PII). */
export async function GET() {
  const started = Date.now();
  try {
    const [r] = await sql()`select
      (select count(*)::int from email_outbox where state = 'queued' and next_attempt_at < now() - interval '5 minutes') as stale_queued,
      (select count(*)::int from email_outbox where state = 'failed') as failed`;
    return NextResponse.json({ ok: true, db: "up", dbLatencyMs: Date.now() - started, outbox: { staleQueued: r.stale_queued, failed: r.failed } });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
