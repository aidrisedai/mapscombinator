import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { listWeeks } from "@/lib/server/domain/cohorts";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatDate, todayIn, weekNumberFor } from "@/lib/time";
import { WeekStateBadge } from "../../../_components/weekState";

export const metadata: Metadata = { title: "Weekly guide" };

export default async function WeeksPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/weeks`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const weeks = await listWeeks(cohort.id);
  const current = weekNumberFor(cohort.startDate, cohort.weekCount, todayIn(cohort.timezone));
  const base = `/manage/cohorts/${cohort.id}/weeks`;
  return (
    <div>
      <PageHeader
        title="Weekly guide"
        description="Write each week's objective, expected work and deliverable. Founders see a week only after you publish it; drafts stay private and saving never sends email."
      />
      <ol className="divide-y divide-line/60 overflow-hidden rounded-lg border border-line/80">
        {weeks.map((w) => {
          const changes = w.content_state === "published" && w.draft_revision_id && w.draft_revision_id !== w.published_revision_id;
          return (
            <li key={w.id as string}>
              <Link href={`${base}/${w.number}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-cream/50 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-20 shrink-0 font-display font-bold text-forest">Week {w.number as number}</span>
                <span className="w-56 shrink-0 text-sm text-ink/70">
                  {formatDate(w.start_date as string)} – {formatDate(w.end_date as string)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{(w.published_title as string) || <span className="text-ink/50">No published title</span>}</span>
                <span className="flex flex-wrap gap-2">
                  {current === w.number && <Badge tone="info">This week</Badge>}
                  <WeekStateBadge state={w.content_state as string} />
                  {changes && <Badge tone="draft">Unpublished changes</Badge>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
