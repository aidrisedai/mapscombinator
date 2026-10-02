import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { listAccessibleCohorts } from "@/lib/server/authz";
import { requirePageAccount } from "@/lib/server/session";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "My program" };

const REL: Record<string, string> = { owner: "Owner", admin: "Administrator", mentor: "Mentor", viewer: "Viewer", founder: "Founder" };

export default async function AppHome({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const account = await requirePageAccount("/app");
  const { password } = await searchParams;
  const cohorts = await listAccessibleCohorts(account);
  const founderCohorts = cohorts.filter((c) => c.relation.includes("founder"));
  // One obvious place to go: straight there.
  if (!password && cohorts.length === 1 && founderCohorts.length === 1) redirect(`/app/cohorts/${cohorts[0].id}`);
  if (!password && !account.isOwner && cohorts.length > 0 && cohorts.every((c) => c.relation.length === 1 && c.relation[0] === "mentor")) redirect("/mentor/appointments");
  return (
    <>
      <PageHeader title={`Welcome, ${account.displayName.split(" ")[0]}`} description="Choose a cohort to open its journal, weekly guide and office hours." />
      {password === "updated" && <div className="mb-6"><Notice tone="success" title="Password updated">You&apos;ve been signed out on your other devices.</Notice></div>}
      {cohorts.length === 0 ? (
        <EmptyState title="No cohorts yet">
          {account.isOwner ? (
            <>
              Start by creating your first cohort in <Link className="font-medium text-emerald" href="/manage/cohorts">Manage</Link>.
            </>
          ) : (
            "When an administrator adds you to a cohort, it will appear here."
          )}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cohorts.map((c) => (
            <Card as="li" key={c.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/app/cohorts/${c.id}`} className="font-display text-lg font-bold text-forest hover:text-emerald">
                  {c.name}
                </Link>
                <Badge tone={c.status === "active" ? "published" : c.status === "draft" ? "draft" : "neutral"}>{c.status}</Badge>
              </div>
              <p className="text-sm text-ink/70">
                Starts {formatDate(c.startDate)} · {c.weekCount} weeks · {c.timezone.replace("_", " ")}
              </p>
              <p className="text-xs text-ink/60">Your role: {c.relation.map((r) => REL[r] ?? r).join(", ")}</p>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
