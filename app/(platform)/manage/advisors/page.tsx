import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/forms";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, cx } from "@/components/ui/primitives";
import { listAllAdvisors } from "@/lib/server/domain/advisors";
import { profileGaps } from "@/lib/server/domain/mentors";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { revokeCohortRoleAction } from "../actions";
import { InvitationList } from "../_components/InvitationList";
import { AddAdvisorForm, AssignToCohort, BulkAdvisors } from "./AdvisorForms";

export const metadata: Metadata = { title: "Advisors" };

type CohortRef = { cohortId: string; cohortName: string; roleId: string; status: string };
const linkCls = "rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest";
const chip = (active: boolean) =>
  cx("rounded-full border px-3 py-1 text-xs font-semibold", active ? "border-forest bg-forest text-paper" : "border-line bg-paper text-ink/70 hover:border-forest hover:text-forest");

export default async function AdvisorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const account = await requirePageAccount("/manage/advisors");
  const data = await load(() => listAllAdvisors(account, one(sp.cohort)));
  const writable = data.cohorts.filter((c) => c.status !== "archived").map((c) => ({ id: c.id as string, name: c.name as string }));
  const defaults = data.filter ? [data.filter] : writable.length === 1 ? [writable[0].id] : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Advisors"
        description="Mentors and advisors across your cohorts. One account works for every cohort they advise: they see those cohorts' startups, daily and weekly progress and weekly materials (never drafts), and founders there can see and book them."
      />

      {data.cohorts.length > 1 && (
        <nav aria-label="Filter by cohort" className="flex flex-wrap gap-2">
          <Link href="/manage/advisors" className={chip(!data.filter)} aria-current={!data.filter ? "page" : undefined}>All cohorts</Link>
          {data.cohorts.map((c) => (
            <Link key={c.id as string} href={`/manage/advisors?cohort=${c.id}`} className={chip(data.filter === c.id)} aria-current={data.filter === c.id ? "page" : undefined}>
              {c.name as string}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle>{data.filter ? "Advisors in this cohort" : "All advisors"} ({data.advisors.length})</SectionTitle>
          {data.advisors.length === 0 ? (
            <EmptyState title="No advisors yet">Add advisors with the form. They&apos;ll get an email to set up their account, or be added straight away if they already have one.</EmptyState>
          ) : (
            <ul className="divide-y divide-line/60">
              {data.advisors.map((r) => {
                const cohorts = r.cohorts as CohortRef[];
                const inIds = new Set(cohorts.map((c) => c.cohortId));
                return (
                  <li key={r.id as string} className="space-y-2 py-4 first:pt-0">
                    <div className="text-sm">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {r.display_name as string}
                        {r.state === "suspended" && <Badge tone="danger">Suspended</Badge>}
                        {profileGaps(r).length > 0 ? <Badge tone="warn">Profile incomplete</Badge> : <Badge tone="published">Profile complete</Badge>}
                        {r.calendar_url ? <Badge tone="info">Booking link</Badge> : (r.rules as number) === 0 && <Badge tone="neutral">No booking times yet</Badge>}
                      </p>
                      {r.headline && <p className="text-xs text-ink/70">{r.headline as string}</p>}
                      <p className="break-all text-xs text-ink/60">{r.email as string}</p>
                    </div>
                    <ul className="flex flex-wrap gap-1.5" aria-label="Cohorts">
                      {cohorts.map((c) => (
                        <li key={c.roleId} className="inline-flex items-center gap-1 rounded-full border border-line bg-cream/60 py-0.5 pl-2.5 pr-1 text-xs">
                          <Link href={`/manage/advisors?cohort=${c.cohortId}`} className="font-medium text-forest hover:text-emerald">{c.cohortName}</Link>
                          {c.status !== "archived" && (
                            <ActionButton
                              action={revokeCohortRoleAction}
                              fields={{ cohortId: c.cohortId, roleId: c.roleId }}
                              label="×"
                              pendingLabel="…"
                              variant="ghost"
                              confirmMessage={`Remove ${r.display_name as string} from ${c.cohortName}? Their access to that cohort ends immediately; their account and other cohorts aren't affected.`}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/mentor/profile?mentor=${r.id}`} className={linkCls}>Profile</Link>
                      <Link href={`/mentor/availability?mentor=${r.id}`} className={linkCls}>Availability</Link>
                      <AssignToCohort accountId={r.id as string} options={writable.filter((c) => !inIds.has(c.id))} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {writable.length > 0 && (
          <div className="space-y-8">
            <Card>
              <SectionTitle>Add an advisor</SectionTitle>
              <p className="mb-4 text-sm text-ink/70">New people get one invitation to set up their account. People who already have one, for example from an earlier cohort, are added straight away.</p>
              <AddAdvisorForm cohorts={writable} defaultCohortIds={defaults} />
              <details className="mt-6 rounded-md border border-line/70 px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink/80">Add several at once (paste a list)</summary>
                <div className="mt-4">
                  <BulkAdvisors cohorts={writable} defaultCohortId={data.filter && writable.some((c) => c.id === data.filter) ? data.filter : writable[0].id} />
                </div>
              </details>
            </Card>
          </div>
        )}
      </div>

      <Card>
        <SectionTitle>Pending advisor invitations</SectionTitle>
        <InvitationList
          rows={data.pending.map((i) => ({ ...i, invitee_name: i.invitee_name ? `${i.invitee_name} · ${i.cohort_name}` : `${i.email} · ${i.cohort_name}` }))}
          timezone="America/Los_Angeles"
          empty="No pending advisor invitations."
        />
      </Card>
    </div>
  );
}
