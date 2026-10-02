import Link from "next/link";
import { Notice } from "@/components/ui/primitives";
import { requireCohortRead } from "@/lib/server/authz";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { CohortTabs } from "./CohortTabs";

export default async function CohortLayout({ children, params }: { children: React.ReactNode; params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}`);
  const a = await load(() => requireCohortRead(account, cohortId));
  const base = `/app/cohorts/${cohortId}`;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink/70">{a.cohort.name}</p>
        {a.isAdmin && (
          <Link href={`/manage/cohorts/${cohortId}`} className="rounded-md border border-line px-3 py-1 text-xs font-semibold text-forest hover:border-forest">
            Manage this cohort
          </Link>
        )}
      </div>
      <CohortTabs base={base} />
      {a.cohort.status === "draft" && (
        <div className="mb-6"><Notice tone="info" title="This cohort hasn't started yet">You can look around. Posting updates and booking mentors open when the program is activated.</Notice></div>
      )}
      {(a.cohort.status === "completed" || a.cohort.status === "archived") && (
        <div className="mb-6"><Notice tone="info" title={`This cohort is ${a.cohort.status}`}>Its history is preserved and read-only.</Notice></div>
      )}
      {children}
    </div>
  );
}
