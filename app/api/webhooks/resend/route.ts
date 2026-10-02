import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { recordDeliveryEvent } from "@/lib/server/email/outbox";
import { env } from "@/lib/server/env";

/** Resend delivery webhooks (Svix-signed). Duplicate deliveries are ignored by event id. */
export async function POST(req: Request) {
  const secret = env().RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  const body = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };
  let event: { type: string; data?: { email_id?: string } };
  try {
    new Webhook(secret).verify(body, headers); // throws on a bad/missing signature or stale timestamp
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }
  await recordDeliveryEvent(headers["svix-id"], event.type, event.data?.email_id ?? null);
  return NextResponse.json({ ok: true });
}
