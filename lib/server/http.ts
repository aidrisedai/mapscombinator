import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { env } from "./env";

/** Route handlers have no built-in CSRF check: require a same-origin Origin header on mutations. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(env().APP_URL).origin;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin) throw new AppError("forbidden", "Missing origin.");
  const o = new URL(origin);
  if (o.origin !== expected && o.host !== host) throw new AppError("forbidden", "Cross-site request refused.");
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    const status = { unauthenticated: 401, forbidden: 403, not_found: 404, conflict: 409, validation: 422, rate_limited: 429, locked: 423 }[err.code];
    return NextResponse.json({ ok: false, error: err.message, fieldErrors: err.fieldErrors }, { status });
  }
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(JSON.stringify({ level: "error", ref, msg: (err as Error)?.message }));
  return NextResponse.json({ ok: false, error: `Something went wrong. Nothing was changed. (ref ${ref})` }, { status: 500 });
}
