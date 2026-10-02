import type { Metadata } from "next";
import { Card, Notice, PageHeader } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { cohortStructureLocked } from "@/lib/server/domain/cohorts";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { CohortSettingsForm } from "../../../_components/CohortForm";

export const metadata: Metadata = { title: "Cohort settings" };

export default async function CohortSettingsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/settings`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const locked = await cohortStructureLocked(cohort.id);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Name, description, program dates and the reply-to contact for this cohort." />
      {cohort.status === "archived" ? (
        <Notice tone="warn" title="Read-only">
          Archived cohorts can&apos;t be edited. A platform owner can restore it from the Overview tab.
        </Notice>
      ) : (
        <>
          {locked && (
            <div className="mb-6">
              <Notice tone="info" title="Program dates are locked">
                Start date, length and timezone are locked because teams have posted updates; week titles/content can still be edited in the Weekly guide.
              </Notice>
            </div>
          )}
          <Card>
            <CohortSettingsForm
              cohortId={cohort.id}
              version={cohort.version}
              locked={locked}
              values={{ name: cohort.name, description: cohort.description, startDate: cohort.startDate, weekCount: cohort.weekCount, timezone: cohort.timezone, supportEmail: cohort.supportEmail ?? "" }}
            />
          </Card>
          <p className="mt-3 text-xs text-ink/60">If someone else saves these settings while you&apos;re editing, you&apos;ll be asked to reload so nothing is overwritten.</p>
        </>
      )}
    </div>
  );
}
