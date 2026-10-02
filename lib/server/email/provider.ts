import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resend } from "resend";
import { env } from "../env";
import type { Rendered } from "./templates";

export type SendResult =
  | { kind: "accepted"; providerId: string }
  | { kind: "suppressed"; note: string }
  | { kind: "failed"; transient: boolean; error: string };

let client: Resend | undefined;

export async function deliver(to: string, msg: Rendered, idempotencyKey: string, replyTo?: string | null): Promise<SendResult> {
  const e = env();
  const allow = e.EMAIL_SANDBOX_ALLOWLIST?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (e.EMAIL_PROVIDER === "log") {
    // Development mailbox: written to disk, never reported as sent.
    const dir = join(process.cwd(), ".data", "mail");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${Date.now()}-${idempotencyKey.replace(/[^a-z0-9-]/gi, "_").slice(0, 80)}.json`), JSON.stringify({ to, ...msg }, null, 2));
    return { kind: "suppressed", note: "Not sent: development mail log (EMAIL_PROVIDER=log)" };
  }
  if (allow && allow.length > 0 && !allow.includes(to.toLowerCase())) {
    return { kind: "suppressed", note: "Not sent: sandbox mode and recipient is not on the test allowlist" };
  }
  client ??= new Resend(e.RESEND_API_KEY);
  try {
    const { data, error } = await client.emails.send(
      { from: e.EMAIL_FROM, to: [to], subject: msg.subject, text: msg.text, html: msg.html, replyTo: replyTo ?? e.EMAIL_REPLY_TO ?? undefined },
      { idempotencyKey },
    );
    if (error || !data) {
      const status = (error as { statusCode?: number } | null)?.statusCode ?? 0;
      return { kind: "failed", transient: status === 0 || status === 429 || status >= 500, error: `${error?.name ?? "error"}: ${error?.message ?? "unknown"}`.slice(0, 300) };
    }
    return { kind: "accepted", providerId: data.id };
  } catch (err) {
    return { kind: "failed", transient: true, error: `network: ${(err as Error).message}`.slice(0, 300) };
  }
}
