import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/forms";
import { Badge, Card, EmptyState, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { listCohortAdvisors, listOtherAdvisors } from "@/lib/server/domain/advisors";
import { listInvitations } from "@/lib/server/domain/invitations";
import { profileGaps } from "@/lib/server/domain/mentors";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { revokeCohortRoleAction } from "../../../actions";
import { InvitationList } from "../../../_components/InvitationList";
import { AddExistingAdvisors, InviteAdvisors } from "./AdvisorForms";

export const metadata: Metadata = { title: "Advisors" };

const linkCls = "rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest";

export default async function AdvisorsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/advisors`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const [advisors, others, invitations] = await Promise.all([listCohortAdvisors(account, cohort.id), listOtherAdvisors(account, cohort.id), listInvitations(cohort.id)]);
  const pending = invitations.filter((i) => i.role === "mentor" && i.state !== "accepted" && i.state !== "revoked");
  const writable = cohort.status !== "archived";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Advisors"
        description="Mentors and advisors for this cohort. They see the startups, their published updates and progress, and the weekly guide (never drafts), and founders can book them. One account works across every cohort they advise."
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle>In this cohort ({advisors.length})</SectionTitle>
          {advisors.length === 0 ? (
            <EmptyState title="No advisors yet">Invite advisors with the form. They&apos;ll get an email to set up their account, or be added straight away if they already have one.</EmptyState>
          ) : (
            <ul className="divide-y divide-line/60">
              {advisors.map((r) => (
                <li key={r.role_id as string} className="space-y-2 py-3 first:pt-0">
                  <div className="text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      {r.display_name as string}
                      {r.state === "suspended" && <Badge tone="danger">Suspended</Badge>}
                      {profileGaps(r).length > 0 ? <Badge tone="warn">Profile incomplete</Badge> : <Badge tone="published">Profile complete</Badge>}
                      {(r.rules as number) === 0 && <Badge tone="neutral">No availability</Badge>}
                    </p>
                    {r.headline && <p className="text-xs text-ink/70">{r.headline as string}</p>}
                    <p className="break-all text-xs text-ink/60">{r.email as string}</p>
                    <p className="text-xs text-ink/50">{(r.upcoming as number) === 1 ? "1 upcoming appointment" : `${r.upcoming} upcoming appointments`}</p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link href={`/mentor/profile?mentor=${r.id}`} className={linkCls}>Profile</Link>
                    <Link href={`/mentor/availability?mentor=${r.id}`} className={linkCls}>Availability</Link>
                    <Link href={`/app/cohorts/${cohort.id}/mentors/${r.id}`} className={linkCls}>View as founder</Link>
                    {writable && (
                      <ActionButton
                        action={revokeCohortRoleAction}
                        fields={{ cohortId: cohort.id, roleId: r.role_id as string }}
                        label="Remove"
                        pendingLabel="Removing…"
                        variant="danger"
                        confirmMessage={`Remove ${r.display_name as string} as an advisor of ${cohort.name}? Their access to this cohort ends immediately; their account and other cohorts aren't affected.`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {writable ? (
          <div className="space-y-8">
            <Card>
              <SectionTitle>Invite advisors</SectionTitle>
              <InviteAdvisors cohortId={cohort.id} />
            </Card>
            {others.length > 0 && (
              <Card>
                <SectionTitle>Add advisors from other cohorts</SectionTitle>
                <p className="mb-4 text-sm text-ink/70">They already have an account, so they&apos;re added immediately and get a short email. No new sign-up.</p>
                <AddExistingAdvisors
                  cohortId={cohort.id}
                  people={others.map((o) => ({ id: o.id as string, name: o.display_name as string, email: o.email as string, headline: (o.headline as string | null) || null, cohorts: o.cohorts as string[] }))}
                />
              </Card>
            )}
          </div>
        ) : (
          <Notice tone="info" title="Read-only">This cohort is archived, so advisors can&apos;t be added.</Notice>
        )}
      </div>

      <Card>
        <SectionTitle>Pending advisor invitations</SectionTitle>
        <InvitationList rows={pending} timezone={cohort.timezone} canManage={() => writable} empty="No pending advisor invitations." />
      </Card>
    </div>
  );
}
