import "server-only";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { runAction } from "./errors";
import { requireAccount, type Account } from "./session";

/**
 * Server-action wrapper: authenticated actor + safe error mapping. On success
 * it refreshes the client router from the server, in the same response, so
 * pages update without a second browser-side refresh racing the action.
 */
export async function act<T>(fn: (actor: Account) => Promise<T>) {
  const r = await runAction(async () => fn(await requireAccount()));
  if (r.ok) refresh();
  return r;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function obj(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) o[k] = v;
  return o;
}
