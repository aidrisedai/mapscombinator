import type { Metadata } from "next";
import { MentorDirectory } from "@/components/mentors/MentorDirectory";
import { PageHeader } from "@/components/ui/primitives";
import { requirePageAccount } from "@/lib/server/session";

export const metadata: Metadata = { title: "Mentors" };

export default async function MentorsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/mentors`);
  return (
    <>
      <PageHeader title="Mentors & advisors" description="The people supporting this cohort: their background, what they can help with, and how to reach or book them." />
      <MentorDirectory account={account} cohortId={cohortId} />
    </>
  );
}
