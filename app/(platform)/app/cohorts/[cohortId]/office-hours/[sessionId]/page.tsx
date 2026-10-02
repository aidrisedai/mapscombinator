import type { Metadata } from "next";
import Link from "next/link";
import { MODE_LABEL, SessionBadges, isUpdated } from "@/components/office-hours/badges";
import { When } from "@/components/office-hours/When";
import { Card, ExternalLink, KeyValue, LinkButton, Notice, PageHeader, Prose, SectionTitle } from "@/components/ui/primitives";
import { listWeeks } from "@/lib/server/domain/cohorts";
import { getSession } from "@/lib/server/domain/office-hours";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";

export const metadata: Metadata = { title: "Session" };

export default async function SessionPage({ params }: { params: Promise<{ cohortId: string; sessionId: string }> }) {
  const { cohortId, sessionId } = await params;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/office-hours/${sessionId}`);
  const { access, session: s } = await load(() => getSession(account, cohortId, sessionId));
  const week = s.week_id ? (await listWeeks(cohortId)).find((w) => w.id === s.week_id) : undefined;
  const cancelled = s.state === "cancelled";
  const past = new Date(s.ends_at) < new Date();
  const minutes = Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/app/cohorts/${cohortId}/office-hours`} className="font-medium text-emerald hover:text-forest">← Office hours</Link>
      </p>
      <PageHeader
        eyebrow="Group session"
        title={s.title}
        description={<SessionBadges state={s.state} updated={isUpdated(s)} admin={access.isAdmin} past={past} />}
        actions={access.isAdmin ? <LinkButton href={`/manage/cohorts/${cohortId}/office-hours/${s.id}`} variant="secondary" size="sm">Manage this session</LinkButton> : undefined}
      />
      <div className="space-y-6">
        {cancelled && (
          <Notice tone="error" title="This session was cancelled">
            {s.cancel_reason || "The program team cancelled this session."}
          </Notice>
        )}
        {s.state === "draft" && (
          <Notice tone="warn" title="Draft">Only administrators can see this session until it&apos;s published.</Notice>
        )}
        {isUpdated(s) && (
          <Notice tone="info" title="Updated">Details changed after this session was first published (last change {formatInstant(s.updated_at, s.timezone)}).</Notice>
        )}
        <Card>
          <KeyValue
            items={[
              ["When", <When key="w" start={s.starts_at} end={s.ends_at} tz={s.timezone} strike={cancelled} />],
              ["Duration", `${minutes} minutes`],
              ["Host", s.host_name || null],
              ["Format", MODE_LABEL[s.mode]],
              ["Meeting link", s.mode !== "in_person" && s.meeting_url && !cancelled ? <ExternalLink key="m" href={s.meeting_url}>{s.meeting_url}</ExternalLink> : null],
              ["Location", s.mode !== "online" && s.location ? s.location : null],
              [
                "Program week",
                week ? (
                  <Link key="wk" className="font-medium text-emerald hover:text-forest" href={`/app/cohorts/${cohortId}/weeks/${week.number}`}>
                    Week {week.number}
                  </Link>
                ) : null,
              ],
            ]}
          />
        </Card>
        {s.description && (
          <section>
            <SectionTitle>About this session</SectionTitle>
            <Prose text={s.description} />
          </section>
        )}
        {s.preparation && (
          <section>
            <SectionTitle>How to prepare</SectionTitle>
            <Card className="bg-cream/40">
              <Prose text={s.preparation} />
            </Card>
          </section>
        )}
        {!cancelled && !past && (
          <p className="text-xs text-ink/60">No sign-up needed — join at the time above. Times are in {s.timezone.replaceAll("_", " ")}.</p>
        )}
      </div>
    </>
  );
}
