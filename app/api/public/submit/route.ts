import { NextResponse } from "next/server";
import { submitPublicForm } from "@/lib/server/domain/submissions";
import { AppError } from "@/lib/server/errors";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

/** Public website forms (Get Involved, Combinator interest). Same-origin only, rate limited. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new AppError("validation", "We couldn't read that form. Please try again.");
    }
    if (!body || typeof body !== "object") throw new AppError("validation", "We couldn't read that form. Please try again.");
    await submitPublicForm(body as Record<string, unknown>, ip);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
