import type { Metadata } from "next";
import { requestNow } from "@/components/office-hours/now";
import Link from "next/link";
import { AnnouncementBadge } from "@/components/office-hours/badges";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { listAnnouncementsForAdmin } from "@/lib/server/domain/announcements";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { AnnouncementForm } from "./AnnouncementForm";
import { announcementFormOptions, expiryDate } from "./data";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { aiConfigured } from "@/lib/server/ai/assistant";

export const metadata: Metadata = { title: "Manage announcements" };

export default async function ManageAnnouncementsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/announcements`);
  const access = await load(() => requireCohortAdmin(account, cohortId));
  const [rows, options] = await Promise.all([load(() => listAnnouncementsForAdmin(account, cohortId)), load(() => announcementFormOptions(account, cohortId))]);
  const tz = access.cohort.timezone;
  const now = requestNow();
  const base = `/manage/cohorts/${cohortId}/announcements`;
  return (
    <>
      <PageHeader title="Announcements" description="Program messages for everyone in the cohort. Save a draft, then publish — emailing a copy is optional." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section>
          <SectionTitle>All announcements</SectionTitle>
          {rows.length === 0 ? (
            <EmptyState title="No announcements yet">Write the first one with the form. It stays a draft until you publish it.</EmptyState>
          ) : (
            <ul className="divide-y divide-line/70 rounded-lg border border-line/80">
              {rows.map((n) => {
                const expired = n.expires_at && new Date(n.expires_at).getTime() <= now;
                return (
                  <li key={n.id} className="space-y-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`${base}/${n.id}`} className="font-semibold text-forest hover:text-emerald">{n.title}</Link>
                      <AnnouncementBadge state={n.state} />
                      {n.pinned && <Badge tone="info">Pinned</Badge>}
                      {expired && <Badge>Expired</Badge>}
                    </div>
                    <p className="text-xs text-ink/60">
                      {n.state === "published" && n.publish_at ? `Published ${formatInstant(n.publish_at, tz)}` : `Updated ${formatInstant(n.updated_at, tz)}`} · {n.author}
                      {n.expires_at && ` · ${expired ? "Expired" : "Expires after"} ${expiryDate(n.expires_at, tz)}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle>New announcement</SectionTitle>
          {access.cohort.status === "archived" ? (
            <p className="text-sm text-ink/70">This cohort is archived, so announcements can&apos;t be added.</p>
          ) : (
            <Card>
              <>
                <AiAssistant kind="announcement" ctx={{ cohortId }} target="#ai-target-announcement" configured={aiConfigured()} title="Write an announcement with AI" placeholder="e.g. Remind everyone demo day is Dec 10 at 6pm at MAPS, 3-minute pitches, slides due Dec 7" />
                <div id="ai-target-announcement">
                  <AnnouncementForm cohortId={cohortId} weeks={options.weeks} sessions={options.sessions} timezone={tz} />
                </div>
              </>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
