import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm } from "@/components/ui/forms";
import { Badge, Card, ExternalLink, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { isUuid, requireCohortAdmin } from "@/lib/server/authz";
import { listInvitations } from "@/lib/server/domain/invitations";
import { getEnrollment, listContacts } from "@/lib/server/domain/startups";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { removeMembershipAction, withdrawEnrollmentAction } from "../../../../actions";
import { InvitationList } from "../../../../_components/InvitationList";
import { InviteContactButton, InviteForm } from "../../../../_components/InviteFlow";
import { StartupProfileForm } from "../../../../_components/ProfileForm";

export const metadata: Metadata = { title: "Startup" };

export default async function StartupDetailPage({ params, searchParams }: { params: Promise<{ cohortId: string; enrollmentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId, enrollmentId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/startups/${enrollmentId}`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  if (!isUuid(enrollmentId)) notFound();
  const { enrollment: e, members } = await load(() => getEnrollment(account, cohort.id, enrollmentId));
  const [contacts, invitations] = await Promise.all([listContacts(cohort.id, e.id), listInvitations(cohort.id, e.id)]);
  const base = `/manage/cohorts/${cohort.id}`;
  const tz = cohort.timezone;
  const active = e.status === "active";
  const writable = cohort.status !== "archived";
  const inviteParam = (one(sp.invite) ?? "").trim().toLowerCase();

  const memberEmails = new Set(members.map((m) => String(m.email ?? "").toLowerCase()));
  const pendingEmails = new Set(invitations.filter((i) => i.state !== "accepted" && i.state !== "revoked").map((i) => String(i.email).toLowerCase()));
  const inviteTarget = contacts.find((c) => String(c.email).toLowerCase() === inviteParam);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`${base}/startups`} className="text-sm font-medium text-emerald hover:text-forest">
          ← All startups
        </Link>
        <div className="mt-3">
          <PageHeader
            title={e.name}
            eyebrow={active ? "Startup" : "Withdrawn startup"}
            description={e.website ? <ExternalLink href={e.website} /> : undefined}
            actions={
              <Link href={`/app/cohorts/${cohort.id}/startups/${e.id}`} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest">
                View team page
              </Link>
            }
          />
        </div>
      </div>

      {one(sp.created) === "1" && <Notice tone="success" title="Startup saved">No invitation was sent. Invite founders from the Contacts section when you&apos;re ready.</Notice>}
      {inviteParam && !inviteTarget && <Notice tone="warn" title="Contact not found">{inviteParam} isn&apos;t one of this startup&apos;s contacts. Use &ldquo;Invite another founder&rdquo; below.</Notice>}
      {!active && <Notice tone="info" title="This startup has withdrawn from the cohort">Its history is preserved. Invitations can&apos;t be sent for a withdrawn startup.</Notice>}

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <SectionTitle>Contacts</SectionTitle>
          <p className="mb-3 text-xs text-ink/60">Contact details are visible to this team and administrators only. Each invitation creates a personal account for that person.</p>
          {contacts.length === 0 ? (
            <p className="text-sm text-ink/60">No contacts yet.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {contacts.map((c) => {
                const email = String(c.email).toLowerCase();
                const hasAccess = memberEmails.has(email);
                const pending = pendingEmails.has(email);
                return (
                  <li key={c.id as string} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-ink">{c.name as string}</span>
                      <span className="break-all text-ink/60">{c.email as string}</span>
                      {c.is_primary ? <Badge tone="info">Primary contact</Badge> : null}
                      {hasAccess && <Badge tone="published">Has joined</Badge>}
                      {!hasAccess && pending && <Badge tone="draft">Invitation pending</Badge>}
                    </div>
                    {active && writable && !hasAccess && (
                      <InviteContactButton cohortId={cohort.id} enrollmentId={e.id} name={c.name as string} email={c.email as string} canInvite={!pending} autoOpen={inviteTarget?.id === c.id} />
                    )}
                    {!hasAccess && pending && <p className="text-xs text-ink/60">Use Resend under Invitations if they need a new link.</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {active && writable && (
            <div className="mt-6 border-t border-line/60 pt-5">
              <p className="mb-3 text-sm font-semibold text-ink">Invite another founder</p>
              <InviteForm cohortId={cohort.id} enrollmentId={e.id} fixedRole="founder" addContact emailHint="Use the founder's own address, not a shared mailbox." />
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Profile</SectionTitle>
          {writable ? (
            <StartupProfileForm
              cohortId={cohort.id}
              enrollmentId={e.id}
              v={{ name: e.name, description: e.description, website: e.website ?? "", contactName: e.contactName ?? "", contactEmail: e.contactEmail ?? "" }}
            />
          ) : (
            <p className="text-sm text-ink/70">{e.description}</p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Founders with access ({members.length})</SectionTitle>
        {members.length === 0 ? (
          <p className="text-sm text-ink/60">Nobody has joined yet. Founders appear here once they accept their invitation.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {members.map((m) => (
              <li key={m.id as string} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium text-ink">{m.display_name as string}</p>
                  <p className="text-xs text-ink/60">
                    {m.email as string} · joined {formatInstant(m.created_at as Date, tz)}
                  </p>
                </div>
                {writable && (
                  <ActionButton
                    action={removeMembershipAction}
                    fields={{ cohortId: cohort.id, enrollmentId: e.id, membershipId: m.id as string }}
                    label="Remove"
                    pendingLabel="Removing…"
                    variant="danger"
                    confirmMessage={`Remove ${m.display_name as string} from ${e.name}? Their access to this startup ends immediately. Their posts stay attributed to them, and their account and other memberships are not affected.`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Invitations</SectionTitle>
        <p className="mb-3 text-xs text-ink/60">Resend creates a fresh link; earlier links stop working. &ldquo;Sent&rdquo; means the email provider accepted the message, which isn&apos;t proof it reached the inbox.</p>
        <InvitationList rows={invitations} timezone={tz} canManage={() => writable} empty="No invitations yet." />
      </Card>

      {active && writable && (
        <Card>
          <SectionTitle>Withdraw from cohort</SectionTitle>
          <p className="text-sm text-ink/70">
            The startup leaves this cohort and its founders lose access to it. Posts and history are preserved. If the startup has upcoming mentor appointments, cancel those first.
          </p>
          <ActionForm
            action={withdrawEnrollmentAction}
            submitLabel="Withdraw startup"
            pendingLabel="Withdrawing…"
            submitVariant="danger"
            after="none"
            confirmMessage={`Withdraw ${e.name} from ${cohort.name}? Its founders lose access to this cohort immediately.`}
            className="mt-4"
          >
            <input type="hidden" name="cohortId" value={cohort.id} />
            <input type="hidden" name="enrollmentId" value={e.id} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
