import { profileGaps } from "@/lib/server/domain/mentors";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/forms";
import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { listCohortRoles } from "@/lib/server/domain/cohorts";
import { listInvitations } from "@/lib/server/domain/invitations";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { revokeCohortRoleAction } from "../../../actions";
import { InvitationList } from "../../../_components/InvitationList";
import { InviteForm } from "../../../_components/InviteFlow";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { aiConfigured } from "@/lib/server/ai/assistant";

export const metadata: Metadata = { title: "Members" };

type Row = Record<string, unknown>;

const GROUPS = [
  { role: "admin", title: "Administrators", blurb: "Run this cohort: startups, invitations, weekly guide, office hours and announcements.", empty: "No cohort administrator yet." },
  { role: "mentor", title: "Mentors & advisors", blurb: "Advise startups, offer bookable appointments and read the published journal.", empty: "No mentors or advisors yet." },
  { role: "viewer", title: "Viewers", blurb: "Read published updates, the weekly guide and sessions. They can't post or see drafts.", empty: "No viewers yet." },
] as const;

export default async function MembersPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/members`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const [roles, invitations] = await Promise.all([listCohortRoles(cohort.id), listInvitations(cohort.id)]);
  const tz = cohort.timezone;
  const writable = cohort.status !== "archived";
  const pending = invitations.filter((i) => i.role !== "founder" && i.state !== "accepted" && i.state !== "revoked");
  const roleOptions = [
    { value: "mentor", label: "Mentor / advisor" },
    { value: "viewer", label: "Viewer" },
    ...(account.isOwner ? [{ value: "admin", label: "Administrator" }] : []),
  ];

  function canRemove(r: Row) {
    if (!writable) return false;
    if (r.role === "admin") return account.isOwner;
    return true;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Members"
        description="Administrators, mentors and viewers of this cohort. Founders are managed on each startup's page. Platform owners can manage every cohort and aren't listed here."
      />

      {roles.filter((r) => r.role === "admin").length === 0 && (
        <Notice tone="warn" title="This cohort has no administrator">
          {account.isOwner ? "Invite at least one administrator below. You can invite yourself by email if you'll run this cohort." : "Ask a platform owner to assign one."}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {GROUPS.map((g) => {
          const list = roles.filter((r) => r.role === g.role);
          return (
            <Card key={g.role}>
              <SectionTitle>
                {g.title} ({list.length})
              </SectionTitle>
              <p className="mb-3 text-xs text-ink/60">{g.blurb}</p>
              {list.length === 0 ? (
                <p className="text-sm text-ink/60">{g.empty}</p>
              ) : (
                <ul className="divide-y divide-line/60">
                  {list.map((r) => (
                    <li key={r.id as string} className="space-y-2 py-3">
                      <div className="text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                          {r.display_name as string}
                          {r.state === "suspended" && <Badge tone="danger">Suspended</Badge>}
                          {r.account_id === account.id && <Badge tone="neutral">You</Badge>}
                          {g.role === "mentor" && profileGaps(r).length > 0 && <Badge tone="warn">Profile incomplete</Badge>}
                        </p>
                        {g.role === "mentor" && r.headline && <p className="text-xs text-ink/70">{r.headline as string}</p>}
                        <p className="break-all text-xs text-ink/60">{r.email as string}</p>
                        <p className="text-xs text-ink/50">Since {formatInstant(r.created_at as Date, tz)}</p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {g.role === "mentor" && (
                          <>
                            <Link href={`/mentor/availability?mentor=${r.account_id}`} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest">
                              Availability
                            </Link>
                            <Link href={`/mentor/profile?mentor=${r.account_id}`} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest">
                              Profile
                            </Link>
                          </>
                        )}
                        {canRemove(r) && (
                          <ActionButton
                            action={revokeCohortRoleAction}
                            fields={{ cohortId: cohort.id, roleId: r.id as string }}
                            label="Remove"
                            pendingLabel="Removing…"
                            variant="danger"
                            confirmMessage={`Remove ${r.display_name as string} as ${g.title.toLowerCase().replace(/s$/, "")} of ${cohort.name}? Their access ends immediately; their account and other cohorts aren't affected.`}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {writable && (
        <Card>
          <SectionTitle>Invite a member</SectionTitle>
          <p className="mb-4 text-sm text-ink/70">
            You&apos;ll see the exact email before anything is sent. If the person already has an account, accepting adds this role to it.
            {!account.isOwner && " Only platform owners can add administrators."}
          </p>
          <>
            <AiAssistant kind="invites" ctx={{ cohortId: cohort.id }} target="#ai-target-invites" configured={aiConfigured()} title="Invite mentors/advisors with AI" intro="Paste names and emails of mentors, advisors or viewers. I list them; each one goes through the normal invitation preview before anything is sent." placeholder="e.g. Advisors: Maya Chen maya@example.org (fundraising), Omar Haddad omar@example.org" />
            <div id="ai-target-invites">
              <InviteForm cohortId={cohort.id} roles={roleOptions} />
            </div>
          </>
        </Card>
      )}

      <Card>
        <SectionTitle>Pending invitations</SectionTitle>
        <InvitationList rows={pending} timezone={tz} showRole canManage={(i) => writable && (i.role !== "admin" || account.isOwner)} empty="No pending invitations for administrators, mentors or viewers." />
      </Card>
    </div>
  );
}
