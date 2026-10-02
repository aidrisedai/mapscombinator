import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { listManagedCohorts } from "@/lib/server/domain/cohorts";
import { requirePageAccount } from "@/lib/server/session";
import { formatDate, programWeeks } from "@/lib/time";
import { StatusBadge } from "../_components/StatusBadge";

export const metadata: Metadata = { title: "Manage cohorts" };

export default async function ManageCohortsPage() {
  const account = await requirePageAccount("/manage/cohorts");
  const cohorts = await listManagedCohorts(account);
  return (
    <>
      <PageHeader
        title="Cohorts"
        description={account.isOwner ? "Every cohort in your organization. Open one to set up startups, members and the weekly guide." : "The cohorts you administer."}
        actions={
          account.isOwner && (
            <>
              <LinkButton href="/manage/platform" variant="secondary">
                Platform settings
              </LinkButton>
              <LinkButton href="/manage/cohorts/new">Create cohort</LinkButton>
            </>
          )
        }
      />
      {cohorts.length === 0 ? (
        <EmptyState
          title="No cohorts yet"
          action={account.isOwner ? <LinkButton href="/manage/cohorts/new">Create your first cohort</LinkButton> : undefined}
        >
          {account.isOwner
            ? "Create a cohort as a draft, assign an administrator, add startups, then activate it when you're ready."
            : "When a platform owner assigns you to a cohort, it will appear here."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cohorts.map((c) => {
            const weeks = programWeeks(c.startDate, c.weekCount);
            return (
              <Card as="li" key={c.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/manage/cohorts/${c.id}`} className="font-display text-lg font-bold text-forest hover:text-emerald">
                    {c.name}
                  </Link>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-sm text-ink/70">
                  {formatDate(weeks[0].startDate)} – {formatDate(weeks[weeks.length - 1].endDate)} · {c.weekCount} weeks · {c.timezone.replaceAll("_", " ")}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="neutral">
                    {c.startupCount} {c.startupCount === 1 ? "startup" : "startups"}
                  </Badge>
                  {c.adminCount === 0 ? <Badge tone="warn">No administrator yet</Badge> : <Badge tone="neutral">{c.adminCount} admin{c.adminCount === 1 ? "" : "s"}</Badge>}
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </>
  );
}
