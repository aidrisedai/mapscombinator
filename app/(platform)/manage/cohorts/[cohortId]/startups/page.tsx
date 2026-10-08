import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { listEnrollments, listReturnableStartups } from "@/lib/server/domain/startups";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { CreateStartupForm, ReenrollStartupForm } from "../../../_components/StartupForms";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { aiConfigured } from "@/lib/server/ai/assistant";

export const metadata: Metadata = { title: "Startups" };

type Row = Record<string, unknown>;

function StartupItem({ e, base }: { e: Row; base: string }) {
  const members = e.member_count as number;
  return (
    <li className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`${base}/startups/${e.id}`} className="font-semibold text-forest hover:text-emerald">
          {e.name as string}
        </Link>
        {members === 0 ? <Badge tone="warn">No founders joined yet</Badge> : <Badge tone="neutral">{members} {members === 1 ? "founder" : "founders"}</Badge>}
      </div>
      <p className="line-clamp-2 text-sm text-ink/70">{e.description as string}</p>
      <p className="text-xs text-ink/60">
        Contact: {e.contact_name as string} · {e.contact_email as string}
      </p>
    </li>
  );
}

export default async function StartupsPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/startups`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const base = `/manage/cohorts/${cohort.id}`;
  const [all, returnable] = await Promise.all([listEnrollments(cohort.id, true), listReturnableStartups(account, cohort.id)]);
  const active = all.filter((e) => e.status === "active");
  const withdrawn = all.filter((e) => e.status !== "active");
  const writable = cohort.status !== "archived";

  return (
    <div className="space-y-8">
      <PageHeader title="Startups" description="Teams enrolled in this cohort. Open a startup to edit its profile, invite founders and manage members." />
      {one(sp.withdrawn) === "1" && <Notice tone="success" title="Startup withdrawn">It no longer appears in this cohort. Its posts are preserved.</Notice>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle>Enrolled ({active.length})</SectionTitle>
          {active.length === 0 ? (
            <EmptyState title="No startups yet">Add the first startup with the form{writable ? "" : " once the cohort is restored"}. You can invite its founders right after saving.</EmptyState>
          ) : (
            <ul className="divide-y divide-line/60">
              {active.map((e) => (
                <StartupItem key={e.id as string} e={e} base={base} />
              ))}
            </ul>
          )}
          {withdrawn.length > 0 && (
            <details className="mt-6 rounded-md border border-line/70 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink/80">Withdrawn ({withdrawn.length})</summary>
              <ul className="mt-3 divide-y divide-line/60">
                {withdrawn.map((e) => (
                  <StartupItem key={e.id as string} e={e} base={base} />
                ))}
              </ul>
            </details>
          )}
        </Card>

        {writable ? (
          <div className="space-y-8">
            <Card>
              <SectionTitle>Add a startup</SectionTitle>
              <>
                <AiAssistant kind="startups" ctx={{ cohortId: cohort.id }} configured={aiConfigured()} title="Add startups with AI" intro="Paste a list, spreadsheet rows or an email about the startups. I draft one card per startup for you to check; saving them sends no emails — you invite founders afterwards." placeholder="e.g. Acme Health — scheduling for clinics — Fatima Ali fatima@acme.health, cofounder Cole Ng cole@acme.health" />
                <CreateStartupForm cohortId={cohort.id} />
              </>
            </Card>
            {returnable.length > 0 && (
              <Card>
                <SectionTitle>Re-enroll a returning startup</SectionTitle>
                <p className="mb-4 text-sm text-ink/70">For a startup from an earlier cohort. Its founders don&apos;t get access here automatically; invite them after re-enrolling.</p>
                <ReenrollStartupForm cohortId={cohort.id} startups={returnable.map((s) => ({ id: s.id as string, name: s.name as string }))} />
              </Card>
            )}
          </div>
        ) : (
          <Notice tone="info" title="Read-only">This cohort is archived, so startups can&apos;t be added.</Notice>
        )}
      </div>
    </div>
  );
}
