import "server-only";

export type ErrorCode = "unauthenticated" | "forbidden" | "not_found" | "conflict" | "validation" | "rate_limited" | "locked" | "unavailable";

/** Expected, user-explainable failure. Messages are safe to show. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const forbidden = (msg = "You don't have access to this.") => new AppError("forbidden", msg);
export const notFound = (msg = "We couldn't find that.") => new AppError("not_found", msg);
export const conflict = (msg: string) => new AppError("conflict", msg);
export const invalid = (msg: string, fieldErrors?: Record<string, string>) => new AppError("validation", msg, fieldErrors);

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; code: ErrorCode | "error"; error: string; fieldErrors?: Record<string, string> };

/** Wraps a server action body: AppErrors become results; unknown errors are logged with a request id. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T extends void ? undefined : T>> {
  try {
    const data = await fn();
    return { ok: true, data } as never;
  } catch (err) {
    // Next.js control-flow (redirect/notFound) must propagate.
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"))) throw err;
    if (err instanceof AppError) return { ok: false, code: err.code, error: err.message, fieldErrors: err.fieldErrors };
    const ref = crypto.randomUUID().slice(0, 8);
    console.error(JSON.stringify({ level: "error", ref, msg: (err as Error)?.message, stack: (err as Error)?.stack?.split("\n").slice(0, 6) }));
    return { ok: false, code: "error", error: `Something went wrong and nothing was saved. Please try again. (ref ${ref})` };
  }
}
