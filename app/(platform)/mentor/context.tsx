import "server-only";
import Link from "next/link";
import { EmptyState, Notice } from "@/components/ui/primitives";
import { AppError } from "@/lib/server/errors";
import { getMentorContext } from "@/lib/server/domain/mentors";
import { load, one } from "@/lib/server/page";
import { requirePageAccount, type Account } from "@/lib/server/session";

export type MentorCtx = Awaited<ReturnType<typeof getMentorContext>>;
type SP = Record<string, string | string[] | undefined>;

/**
 * Resolve whose mentor area this is: the viewer, or `?mentor=<id>` for an
 * administrator managing on that mentor's behalf (checked by the domain).
 */
export async function mentorPage(path: string, sp: SP): Promise<{ account: Account; ctx: MentorCtx | null; q: string }> {
  const param = one(sp.mentor);
  const account = await requirePageAccount(param ? `${path}?mentor=${encodeURIComponent(param)}` : path);
  if (param && param !== account.id) {
    const ctx = await load(() => getMentorContext(account, param));
    return { account, ctx, q: `?mentor=${encodeURIComponent(param)}` };
  }
  try {
    return { account, ctx: await getMentorContext(account, account.id), q: "" };
  } catch (err) {
    if (err instanceof AppError && (err.code === "forbidden" || err.code === "not_found")) return { account, ctx: null, q: "" };
    throw err;
  }
}

export function NotAMentor() {
  return (
    <EmptyState title="You're not a mentor in any cohort">
      When a program administrator adds you as a mentor, your appointments, availability and profile will be here.{" "}
      <Link className="font-medium text-emerald hover:text-forest" href="/app">Back to my program</Link>
    </EmptyState>
  );
}

export function OnBehalfBanner({ ctx }: { ctx: MentorCtx }) {
  if (ctx.self) return null;
  return (
    <div className="mb-6">
      <Notice tone="warn" title={`You are managing availability for ${ctx.mentor.displayName}`}>
        Changes you make here are recorded as made by you on their behalf. You can act only for cohorts you administer: {ctx.cohorts.map((c) => c.name).join(", ")}.
      </Notice>
    </div>
  );
}
