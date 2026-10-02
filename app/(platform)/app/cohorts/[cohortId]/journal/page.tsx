import type { Metadata } from "next";
import Link from "next/link";
import { UpdateCard } from "@/components/journal/UpdateCard";
import { EmptyState, PageHeader, Pagination, SectionTitle } from "@/components/ui/primitives";
import { listEnrollments } from "@/lib/server/domain/startups";
import { listJournal } from "@/lib/server/domain/updates";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { JournalFilters } from "./JournalFilters";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/journal`);
  const kind = (["daily", "weekly"].includes(one(sp.kind) ?? "") ? one(sp.kind) : "all") as "daily" | "weekly" | "all";
  const week = Number(one(sp.week)) || undefined;
  const startup = one(sp.startup) || undefined;
  const page = Number(one(sp.page)) || 1;
  const j = await load(() => listJournal(account, cohortId, { kind, week, enrollmentId: startup, page }));
  const startups = await listEnrollments(cohortId);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (kind !== "all") u.set("kind", kind);
    if (week) u.set("week", String(week));
    if (startup) u.set("startup", startup);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/app/cohorts/${cohortId}/journal${s ? `?${s}` : ""}`;
  };
  const tz = j.access.cohort.timezone;
  return (
    <>
      <PageHeader title="Cohort journal" description="Published daily updates and weekly summaries from every startup in this cohort." />
      <JournalFilters
        kind={kind}
        week={week ? String(week) : ""}
        startup={startup ?? ""}
        weekCount={j.access.cohort.weekCount}
        startups={startups.map((s) => ({ id: s.id as string, name: s.name as string }))}
      />
      {j.drafts.length > 0 && (
        <section className="mb-8 rounded-lg border border-dashed border-sand bg-sand/10 p-4">
          <SectionTitle>Your team&apos;s private drafts</SectionTitle>
          <p className="-mt-2 mb-3 text-xs text-ink/60">Only your team and program administrators can see these until you publish.</p>
          <div className="space-y-3">
            {j.drafts.map((u) => <UpdateCard key={u.id} u={u} cohortId={cohortId} tz={tz} compact />)}
          </div>
        </section>
      )}
      {j.items.length === 0 ? (
        <EmptyState title={page > 1 ? "No more updates" : "No published updates match"}>
          {kind !== "all" || week || startup ? <Link className="font-medium text-emerald" href={`/app/cohorts/${cohortId}/journal`}>Clear filters</Link> : "Updates appear here as teams publish them."}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {j.items.map((u) => <UpdateCard key={u.id} u={u} cohortId={cohortId} tz={tz} />)}
        </div>
      )}
      <Pagination page={j.page} hasMore={j.hasMore} hrefFor={qs} />
    </>
  );
}
