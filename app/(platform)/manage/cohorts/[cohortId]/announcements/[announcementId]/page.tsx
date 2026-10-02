import type { Metadata } from "next";
import { requestNow } from "@/components/office-hours/now";
import Link from "next/link";
import { AnnouncementBadge, EmailCounts } from "@/components/office-hours/badges";
import { Badge, Card, KeyValue, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { sql } from "@/lib/server/db";
import { announcementEmailCounts, getAnnouncementForAdmin } from "@/lib/server/domain/announcements";
import { recipientCount } from "@/lib/server/domain/recipients";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { AnnouncementForm } from "../AnnouncementForm";
import { announcementFormOptions, expiryDate, expiryIsoDate } from "../data";
import { EmailCopyForm, PublishAnnouncementForm, UnpublishButton } from "./forms";

export const metadata: Metadata = { title: "Announcement" };

export default async function ManageAnnouncementPage({ params, searchParams }: { params: Promise<{ cohortId: string; announcementId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId, announcementId } = await params;
  const created = one((await searchParams).created) === "1";
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/announcements/${announcementId}`);
  const { access, announcement: n } = await load(() => getAnnouncementForAdmin(account, cohortId, announcementId));
  const [options, emails, recipients] = await Promise.all([
    load(() => announcementFormOptions(account, cohortId)),
    load(() => announcementEmailCounts(account, cohortId, announcementId)),
    recipientCount(sql(), cohortId),
  ]);
  const tz = access.cohort.timezone;
  const writable = access.cohort.status !== "archived";
  const published = n.state === "published";
  const expired = n.expires_at && new Date(n.expires_at).getTime() <= requestNow();
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/manage/cohorts/${cohortId}/announcements`} className="font-medium text-emerald hover:text-forest">← All announcements</Link>
      </p>
      <PageHeader
        eyebrow="Announcement"
        title={n.title}
        description={
          <span className="inline-flex flex-wrap gap-1.5">
            <AnnouncementBadge state={n.state} />
            {n.pinned && <Badge tone="info">Pinned</Badge>}
            {expired && <Badge>Expired</Badge>}
          </span>
        }
        actions={published ? <Link href={`/app/cohorts/${cohortId}/announcements`} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest">View as member</Link> : undefined}
      />
      <div className="space-y-8">
        {created && <Notice tone="success" title="Draft saved">Only administrators can see it until you publish.</Notice>}
        <Card>
          <KeyValue
            items={[
              ["Author", n.author],
              ["Last edited", `${formatInstant(n.updated_at, tz)} by ${n.updated_by_name}`],
              ["Published", n.publish_at ? formatInstant(n.publish_at, tz) : "Not yet"],
              ["Expires", n.expires_at ? `After ${expiryDate(n.expires_at, tz)}` : "Never"],
              ["Emails", <EmailCounts key="e" rows={emails as unknown as { state: string; n: number }[]} />],
            ]}
          />
        </Card>

        {writable && (
          <section>
            <SectionTitle>{published ? "Email and visibility" : "Publish"}</SectionTitle>
            <Card className="space-y-5">
              {published ? (
                <>
                  <p className="text-sm text-ink/70">Published and visible to the cohort. You can email a copy now, or unpublish it to hide it again.</p>
                  <EmailCopyForm cohortId={cohortId} announcementId={n.id} recipients={recipients} />
                  <div className="border-t border-line/70 pt-4">
                    <UnpublishButton cohortId={cohortId} announcementId={n.id} />
                  </div>
                </>
              ) : (
                <PublishAnnouncementForm cohortId={cohortId} announcementId={n.id} recipients={recipients} />
              )}
            </Card>
          </section>
        )}

        <section>
          <SectionTitle>{writable ? "Edit" : "Content"}</SectionTitle>
          {writable ? (
            <Card>
              {published && <p className="mb-4 text-sm text-ink/70">Changes appear to members as soon as you save. Emails already queued keep the earlier text.</p>}
              <AnnouncementForm
                cohortId={cohortId}
                announcementId={n.id}
                weeks={options.weeks}
                sessions={options.sessions}
                timezone={tz}
                defaults={{
                  title: n.title,
                  body: n.body,
                  link: n.link ?? "",
                  pinned: n.pinned,
                  expiresOn: n.expires_at ? expiryIsoDate(n.expires_at, tz) : "",
                  weekNumber: n.week_number ?? 0,
                  sessionId: n.session_id ?? "",
                }}
              />
            </Card>
          ) : (
            <Card>
              <p className="whitespace-pre-line text-sm">{n.body}</p>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
