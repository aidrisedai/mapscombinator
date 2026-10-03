import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ui/forms";
import { Badge, Card, PageHeader, Pagination, SectionTitle, buttonClass } from "@/components/ui/primitives";
import { listOwnerInvitations } from "@/lib/server/domain/invitations";
import { getOrganization, listAccounts, listOwners } from "@/lib/server/domain/organization";
import { one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { removeOwnerAction, setAccountStateAction } from "../actions";
import { InvitationList } from "../_components/InvitationList";
import { InviteForm } from "../_components/InviteFlow";
import { OrganizationForm } from "../_components/OrgForm";

export const metadata: Metadata = { title: "Platform settings" };

const TZ = "America/Los_Angeles";

export default async function PlatformPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await requirePageAccount("/manage/platform");
  if (!account.isOwner) notFound();
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const page = Number(one(sp.page)) || 1;
  const [org, owners, ownerInvites, accounts] = await Promise.all([
    getOrganization(undefined, account.organizationId),
    listOwners(account),
    listOwnerInvitations(account),
    listAccounts(account, { q, page }),
  ]);
  if (!org) notFound();
  const hrefFor = (p: number) => {
    const s = new URLSearchParams();
    if (accounts.q) s.set("q", accounts.q);
    if (p > 1) s.set("page", String(p));
    const str = s.toString();
    return `/manage/platform${str ? `?${str}` : ""}#accounts`;
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Platform settings" description="Organization details, platform owners and every account. Only platform owners can see this page." />

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <SectionTitle>Organization</SectionTitle>
          <OrganizationForm v={{ name: org.name, supportEmail: org.supportEmail ?? "", replyToEmail: org.replyToEmail ?? "", invitationValidDays: org.invitationValidDays }} />
        </Card>

        <div className="space-y-8">
          <Card>
            <SectionTitle>Platform owners ({owners.length})</SectionTitle>
            <p className="mb-3 text-xs text-ink/60">Owners manage every cohort, assign administrators and see this page. The last active owner can&apos;t be removed.</p>
            <ul className="divide-y divide-line/60">
              {owners.map((o) => (
                <li key={o.id as string} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      {o.display_name as string}
                      {o.id === account.id && <Badge tone="neutral">You</Badge>}
                      {o.state === "suspended" && <Badge tone="danger">Suspended</Badge>}
                    </p>
                    <p className="break-all text-xs text-ink/60">{o.email as string}</p>
                  </div>
                  <ActionButton
                    action={removeOwnerAction}
                    fields={{ accountId: o.id as string }}
                    label="Remove owner"
                    pendingLabel="Removing…"
                    variant="danger"
                    confirmMessage={
                      o.id === account.id
                        ? "Remove your own platform owner access? You'll keep any cohort roles you hold, but lose access to this page."
                        : `Remove platform owner access from ${o.display_name as string}? Their account and any cohort roles stay.`
                    }
                  />
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-line/60 pt-5">
              <p className="mb-3 text-sm font-semibold text-ink">Invite an owner</p>
              <InviteForm cohortId={null} fixedRole="owner" />
            </div>
            {ownerInvites.length > 0 && (
              <div className="mt-5 border-t border-line/60 pt-5">
                <p className="mb-1 text-sm font-semibold text-ink">Pending owner invitations</p>
                <InvitationList rows={ownerInvites} timezone={TZ} empty="" />
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Platform export</SectionTitle>
            <p className="text-sm text-ink/70">A full JSON export of every cohort, including private drafts and contact details. Store it securely.</p>
            <a href="/api/export/platform" download className={`${buttonClass("secondary")} mt-3`}>
              Download platform export
            </a>
          </Card>
        </div>
      </div>

      <section id="accounts" aria-labelledby="accounts-title">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="accounts-title" className="text-base font-semibold text-ink">
              All accounts
            </h2>
            <p className="mt-1 text-sm text-ink/70">Suspending blocks the person&apos;s access immediately, on every device, until reactivated. Their posts and history are kept.</p>
          </div>
          <form method="get" action="/manage/platform#accounts" className="flex items-end gap-2" role="search">
            <label className="text-sm font-semibold text-ink">
              <span className="block">Search by email</span>
              <input name="q" type="search" defaultValue={accounts.q} className="mt-1 w-56 rounded-md border border-line bg-paper px-3 py-2 text-sm" />
            </label>
            <button className={buttonClass("secondary")}>Search</button>
          </form>
        </div>
        {accounts.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-cream/40 px-4 py-6 text-center text-sm text-ink/70">{accounts.q ? `No accounts match “${accounts.q}”.` : "No accounts yet."}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-lg border border-line/80">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-cream/60 text-xs uppercase tracking-wide text-ink/60">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Email</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Access</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Created</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {accounts.items.map((a) => {
                  const roles = a.role_count as number;
                  const teams = a.membership_count as number;
                  return (
                    <tr key={a.id as string}>
                      <td className="px-3 py-2.5 font-medium">{a.display_name as string}</td>
                      <td className="break-all px-3 py-2.5 text-ink/80">{a.email as string}</td>
                      <td className="px-3 py-2.5 text-xs text-ink/70">
                        {[a.is_owner ? "Owner" : null, roles ? `${roles} cohort role${roles === 1 ? "" : "s"}` : null, teams ? `${teams} startup${teams === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "No current access"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink/70">{formatInstant(a.created_at as Date, TZ)}</td>
                      <td className="px-3 py-2.5">{a.state === "active" ? <Badge tone="published">Active</Badge> : <Badge tone="danger">Suspended</Badge>}</td>
                      <td className="px-3 py-2.5">
                        {a.id !== account.id &&
                          (a.state === "active" ? (
                            <ActionButton
                              action={setAccountStateAction}
                              fields={{ accountId: a.id as string, state: "suspended" }}
                              label="Suspend"
                              pendingLabel="Suspending…"
                              variant="danger"
                              confirmMessage={`Suspend ${a.email as string}? They lose access to every cohort immediately until reactivated.`}
                            />
                          ) : (
                            <ActionButton action={setAccountStateAction} fields={{ accountId: a.id as string, state: "active" }} label="Reactivate" pendingLabel="Reactivating…" />
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={accounts.page} hasMore={accounts.hasMore} hrefFor={hrefFor} />
      </section>
    </div>
  );
}
