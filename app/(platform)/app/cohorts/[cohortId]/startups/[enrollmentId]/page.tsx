import type { Metadata } from "next";
import Link from "next/link";
import { UpdateCard } from "@/components/journal/UpdateCard";
import { Card, EmptyState, ExternalLink, KeyValue, LinkButton, PageHeader, Pagination, Prose, SectionTitle } from "@/components/ui/primitives";
import { getEnrollment } from "@/lib/server/domain/startups";
import { listTeamTimeline } from "@/lib/server/domain/updates";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { ProfileEditor } from "./ProfileEditor";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { aiConfigured } from "@/lib/server/ai/assistant";

export const metadata: Metadata = { title: "Startup" };

export default async function StartupPage({ params, searchParams }: { params: Promise<{ cohortId: string; enrollmentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId, enrollmentId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/startups/${enrollmentId}`);
  const { access, enrollment, members, canSeePrivate } = await load(() => getEnrollment(account, cohortId, enrollmentId));
  const kind = (["daily", "weekly"].includes(one(sp.kind) ?? "") ? one(sp.kind) : "all") as "daily" | "weekly" | "all";
  const page = Number(one(sp.page)) || 1;
  const t = await listTeamTimeline(account, cohortId, enrollmentId, { kind, page });
  const isTeam = access.founderOf.some((f) => f.enrollmentId === enrollmentId);
  const canEdit = (isTeam && access.cohort.status === "active") || access.isAdmin;
  const href = (p: number, k = kind) => `/app/cohorts/${cohortId}/startups/${enrollmentId}?${k !== "all" ? `kind=${k}&` : ""}${p > 1 ? `page=${p}` : ""}`;
  return (
    <>
      <PageHeader
        title={enrollment.name}
        description={<Prose text={enrollment.description} />}
        actions={isTeam && access.cohort.status === "active" ? <LinkButton href={`/app/cohorts/${cohortId}/updates/new?team=${enrollmentId}`}>Write update</LinkButton> : undefined}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Timeline</h2>
            <div className="flex gap-1 text-sm">
              {(["all", "daily", "weekly"] as const).map((k) => (
                <Link key={k} href={href(1, k)} aria-current={kind === k ? "page" : undefined} className={`rounded px-2.5 py-1 font-medium ${kind === k ? "bg-forest text-paper" : "text-ink/70 hover:text-forest"}`}>
                  {k === "all" ? "All" : k === "daily" ? "Daily" : "Weekly"}
                </Link>
              ))}
            </div>
          </div>
          {canSeePrivate && <p className="mb-4 text-xs text-ink/60">You can see this team&apos;s private drafts because you&apos;re {isTeam ? "on the team" : "a program administrator"}. Others see only published updates.</p>}
          {t.items.length === 0 ? (
            <EmptyState title="No updates yet">{isTeam ? "Your first daily update will appear here." : "This startup hasn't published any updates yet."}</EmptyState>
          ) : (
            <div className="space-y-4">{t.items.map((u) => <UpdateCard key={u.id} u={u} cohortId={cohortId} tz={access.cohort.timezone} showStartup={false} />)}</div>
          )}
          <Pagination page={t.page} hasMore={t.hasMore} hrefFor={(p) => href(p)} />
        </section>
        <aside className="space-y-6">
          <Card>
            <SectionTitle>Profile</SectionTitle>
            <KeyValue
              items={[
                ["Website", enrollment.website ? <ExternalLink href={enrollment.website} /> : null],
                ["Primary contact", canSeePrivate ? `${enrollment.contactName} · ${enrollment.contactEmail}` : null],
              ]}
            />
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/50">Team</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {members.length === 0 && <li className="text-ink/60">No founders have joined yet.</li>}
              {members.map((m) => (
                <li key={m.id}>{m.display_name}{m.email ? <span className="text-ink/50"> · {m.email}</span> : null}</li>
              ))}
            </ul>
          </Card>
          {canEdit && (
            <Card>
              <SectionTitle>Edit profile</SectionTitle>
              <>
                <AiAssistant kind="startupProfile" ctx={{ cohortId, enrollmentId }} target="#ai-target-startup-profile" configured={aiConfigured()} audience="founder" title="Improve with AI" placeholder="e.g. Describe what you build and who it helps" />
                <div id="ai-target-startup-profile">
                  <ProfileEditor cohortId={cohortId} enrollmentId={enrollmentId} name={enrollment.name} description={enrollment.description} website={enrollment.website ?? ""} />
                </div>
              </>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
