import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { requireCohortRead } from "@/lib/server/authz";
import { listWeeks } from "@/lib/server/domain/cohorts";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatShortDate, todayIn, weekNumberFor } from "@/lib/time";

export const metadata: Metadata = { title: "Weekly guide" };

export default async function WeeksPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/weeks`);
  const a = await load(() => requireCohortRead(account, cohortId));
  const weeks = await listWeeks(cohortId);
  const current = weekNumberFor(a.cohort.startDate, a.cohort.weekCount, todayIn(a.cohort.timezone));
  return (
    <>
      <PageHeader title="Weekly guide" description="What the program expects each week, with slides and resources." />
      <ol className="divide-y divide-line rounded-lg border border-line">
        {weeks.map((w) => {
          const published = w.content_state === "published";
          return (
            <li key={w.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${w.number === current ? "bg-cream/60" : ""}`}>
              <span className="w-20 shrink-0 text-sm font-semibold text-ink/60">Week {w.number}</span>
              <span className="w-32 shrink-0 text-sm text-ink/60">{formatShortDate(w.start_date)} – {formatShortDate(w.end_date)}</span>
              {published ? (
                <Link href={`/app/cohorts/${cohortId}/weeks/${w.number}`} className="min-w-0 flex-1 font-medium text-forest hover:text-emerald">{w.published_title}</Link>
              ) : (
                <span className="min-w-0 flex-1 text-sm text-ink/50">Not published yet{a.isAdmin && w.content_state === "draft" ? " (draft exists)" : ""}</span>
              )}
              {w.number === current && <Badge tone="published">This week</Badge>}
              {a.isAdmin && !published && w.content_state !== "none" && (
                <Link href={`/app/cohorts/${cohortId}/weeks/${w.number}?preview=1`} className="text-xs font-medium text-emerald">Preview</Link>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
