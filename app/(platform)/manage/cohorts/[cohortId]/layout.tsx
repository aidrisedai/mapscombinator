import Link from "next/link";
import { Notice } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatDate, programWeeks } from "@/lib/time";
import { ManageTabs } from "../../_components/ManageTabs";
import { StatusBadge } from "../../_components/StatusBadge";

export default async function ManageCohortLayout({ children, params }: { children: React.ReactNode; params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const base = `/manage/cohorts/${cohort.id}`;
  const weeks = programWeeks(cohort.startDate, cohort.weekCount);
  return (
    <div>
      <Link href="/manage/cohorts" className="text-sm font-medium text-emerald hover:text-forest">
        ← All cohorts
      </Link>
      <div className="mb-5 mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-2xl font-bold text-forest sm:text-3xl">{cohort.name}</p>
            <StatusBadge status={cohort.status} />
          </div>
          <p className="mt-1 text-sm text-ink/70">
            {formatDate(weeks[0].startDate)} – {formatDate(weeks[weeks.length - 1].endDate)} · {cohort.weekCount} weeks · {cohort.timezone.replaceAll("_", " ")}
          </p>
        </div>
        <Link href={`/app/cohorts/${cohort.id}`} className="self-start rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest">
          View as member
        </Link>
      </div>
      <ManageTabs base={base} />
      {cohort.status === "archived" && (
        <div className="mb-6">
          <Notice tone="warn" title="This cohort is archived">
            Its history is preserved and read-only. {account.isOwner ? "Restore it from the Overview tab to make changes." : "A platform owner can restore it if changes are needed."}
          </Notice>
        </div>
      )}
      {cohort.status === "completed" && (
        <div className="mb-6">
          <Notice tone="info" title="This cohort is completed">
            Founders can read its history but can no longer post. Administrators can still correct content.
          </Notice>
        </div>
      )}
      {children}
    </div>
  );
}
