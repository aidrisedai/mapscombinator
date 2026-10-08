import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requirePageAccount } from "@/lib/server/session";
import { NewCohortForm } from "../../_components/CohortForm";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { aiConfigured } from "@/lib/server/ai/assistant";

export const metadata: Metadata = { title: "Create cohort" };

export default async function NewCohortPage() {
  const account = await requirePageAccount("/manage/cohorts/new");
  if (!account.isOwner) notFound();
  return (
    <div className="max-w-3xl">
      <Link href="/manage/cohorts" className="text-sm font-medium text-emerald hover:text-forest">
        ← All cohorts
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Create cohort"
          description="Set the program basics. The cohort is saved as a draft; next you'll assign an administrator, add startups and write the weekly guide before activating it."
        />
      </div>
      <Card>
        <>
          <AiAssistant kind="cohort" target="#ai-target-cohort" configured={aiConfigured()} placeholder="e.g. Spring 2027 cohort, starts March 1, 10 weeks, Seattle time. Support email program@maps.org" />
          <div id="ai-target-cohort">
            <NewCohortForm />
          </div>
        </>
      </Card>
    </div>
  );
}
