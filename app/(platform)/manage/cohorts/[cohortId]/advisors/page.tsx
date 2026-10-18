import { redirect } from "next/navigation";

/** Advisors are managed for all cohorts in one place. */
export default async function CohortAdvisorsRedirect({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  redirect(`/manage/advisors?cohort=${encodeURIComponent(cohortId)}`);
}
