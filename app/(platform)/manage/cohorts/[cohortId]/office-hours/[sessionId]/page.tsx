import type { Metadata } from "next";
import { requestNow } from "@/components/office-hours/now";
import Link from "next/link";
import { EmailCounts, MODE_LABEL, SessionBadges, isUpdated } from "@/components/office-hours/badges";
import { When } from "@/components/office-hours/When";
import { Card, ExternalLink, KeyValue, LinkButton, Notice, PageHeader, Prose, SectionTitle, cx } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { sql } from "@/lib/server/db";
import { getSession, listSeriesOccurrences, sessionEmailCounts } from "@/lib/server/domain/office-hours";
import { recipientCount } from "@/lib/server/domain/recipients";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant, formatTimeRange, weekNumberFor } from "@/lib/time";
import { sessionFormOptions } from "../data";
import { CancelSessionForm, EditSessionForm, PublishSessionForm } from "./forms";

export const metadata: Metadata = { title: "Manage session" };

const TEMPLATE: Record<string, string> = { session_published: "Announcement", session_changed: "Change", session_cancelled: "Cancellation" };
const REV_STATE: Record<string, string> = { draft: "Draft", published: "Published", cancelled: "Cancelled" };

export default async function ManageSessionPage({ params, searchParams }: { params: Promise<{ cohortId: string; sessionId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId, sessionId } = await params;
  const created = Number(one((await searchParams).created) ?? 0);
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/office-hours/${sessionId}`);
  const access = await load(() => requireCohortAdmin(account, cohortId));
  const { session: s, history, localDate, localTime } = await load(() => getSession(account, cohortId, sessionId));
  const [{ hosts, weeks, weekNumberById }, emailRows, recipients, series] = await Promise.all([
    load(() => sessionFormOptions(account, cohortId)),
    load(() => sessionEmailCounts(account, cohortId, sessionId)),
    recipientCount(sql(), cohortId),
    s.series_id ? load(() => listSeriesOccurrences(account, cohortId, s.series_id)) : Promise.resolve([]),
  ]);
  const now = requestNow();
  const past = new Date(s.ends_at).getTime() < now;
  const started = new Date(s.starts_at).getTime() <= now;
  const writable = access.cohort.status !== "archived";
  const editable = writable && !past && s.state !== "cancelled";
  const cancellable = writable && !started && s.state !== "cancelled";
  const seriesDrafts = series.filter((o) => o.state === "draft" && new Date(o.starts_at).getTime() > now).length;
  const canPublish = writable && ((s.state === "draft" && !started) || (s.series_id && seriesDrafts > 0));
  const minutes = Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000);
  const week = s.week_id ? weekNumberById.get(s.week_id) : undefined;
  // Keep "Automatic" when the stored week is simply the week the date falls in.
  const autoWeek = weekNumberFor(access.cohort.startDate, access.cohort.weekCount, localDate);
  const weekDefault = week && week !== autoWeek ? week : 0;
  const byTemplate = new Map<string, { state: string; n: number }[]>();
  for (const r of emailRows) byTemplate.set(r.template, [...(byTemplate.get(r.template) ?? []), { state: r.state, n: r.n }]);
  const base = `/manage/cohorts/${cohortId}/office-hours`;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={base} className="font-medium text-emerald hover:text-forest">← All sessions</Link>
      </p>
      <PageHeader
        eyebrow="Group session"
        title={s.title}
        description={<SessionBadges state={s.state} updated={isUpdated(s)} admin past={past} />}
        actions={s.state !== "draft" ? <LinkButton href={`/app/cohorts/${cohortId}/office-hours/${s.id}`} variant="secondary" size="sm">View as member</LinkButton> : undefined}
      />
      <div className="space-y-8">
        {created > 0 && (
          <Notice tone="success" title={created === 1 ? "Draft created" : `${created} draft sessions created`}>
            Drafts are visible only to administrators. Publish when the details are final.
          </Notice>
        )}
        {s.state === "cancelled" && <Notice tone="error" title="Cancelled">{s.cancel_reason || "No reason recorded."}</Notice>}
        {past && s.state !== "cancelled" && <Notice tone="info" title="This session has ended">Past sessions are kept as history and can&apos;t be changed.</Notice>}

        <Card>
          <KeyValue
            items={[
              ["When", <When key="w" start={s.starts_at} end={s.ends_at} tz={s.timezone} strike={s.state === "cancelled"} />],
              ["Duration", `${minutes} minutes`],
              ["Host", s.host_name || null],
              ["Format", MODE_LABEL[s.mode]],
              ["Meeting link", s.meeting_url ? <ExternalLink key="m" href={s.meeting_url} /> : null],
              ["Location", s.location || null],
              ["Week", week ? `Week ${week}` : null],
              ["Series", s.series_id ? `Occurrence ${s.series_position} of ${series.length}` : null],
              ["Published", s.published_at ? formatInstant(s.published_at, s.timezone) : "Not yet"],
              ["Last emailed", s.last_notified_at ? formatInstant(s.last_notified_at, s.timezone) : "Never"],
            ]}
          />
          {(s.description || s.preparation) && (
            <div className="mt-4 space-y-3 border-t border-line/70 pt-4">
              {s.description && <Prose text={s.description} />}
              {s.preparation && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">How to prepare</p>
                  <Prose text={s.preparation} />
                </div>
              )}
            </div>
          )}
        </Card>

        {canPublish && (
          <section>
            <SectionTitle>Publish</SectionTitle>
            <Card>
              <PublishSessionForm cohortId={cohortId} sessionId={s.id} thisIsDraft={s.state === "draft" && !started} seriesDrafts={seriesDrafts} recipients={recipients} />
            </Card>
          </section>
        )}

        {editable && (
          <section>
            <SectionTitle>Edit</SectionTitle>
            <Card>
              <EditSessionForm
                cohortId={cohortId}
                sessionId={s.id}
                hosts={hosts}
                weeks={weeks}
                timezone={s.timezone}
                inSeries={Boolean(s.series_id)}
                published={s.state === "published"}
                previouslyEmailed={Boolean(s.last_notified_at)}
                recipients={recipients}
                defaults={{
                  title: s.title,
                  hostAccountId: s.host_account_id ?? "",
                  hostName: s.host_name,
                  date: localDate,
                  startTime: localTime,
                  durationMinutes: minutes,
                  mode: s.mode,
                  meetingUrl: s.meeting_url ?? "",
                  location: s.location ?? "",
                  description: s.description,
                  preparation: s.preparation,
                  weekNumber: weekDefault,
                }}
              />
            </Card>
          </section>
        )}

        {cancellable && (
          <section>
            <SectionTitle>Cancel</SectionTitle>
            <Card>
              <CancelSessionForm
                cohortId={cohortId}
                sessionId={s.id}
                inSeries={Boolean(s.series_id)}
                published={s.state === "published"}
                previouslyEmailed={Boolean(s.last_notified_at)}
                recipients={recipients}
              />
            </Card>
          </section>
        )}

        {series.length > 0 && (
          <section>
            <SectionTitle>All occurrences in this series</SectionTitle>
            <ol className="divide-y divide-line/70 rounded-lg border border-line/80 text-sm">
              {series.map((o) => (
                <li key={o.id} className={cx("flex flex-wrap items-center justify-between gap-2 px-4 py-2.5", o.id === s.id && "bg-cream/50")}>
                  <Link href={`${base}/${o.id}`} className={cx("font-medium text-forest hover:text-emerald", o.state === "cancelled" && "line-through decoration-error/60")}>
                    {o.series_position}. {formatTimeRange(o.starts_at, o.ends_at, o.timezone)}
                  </Link>
                  <SessionBadges state={o.state} admin past={new Date(o.ends_at).getTime() < now} />
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <SectionTitle>Emails</SectionTitle>
          <Card className="space-y-1.5 text-sm">
            {byTemplate.size === 0 ? (
              <p className="text-ink/60">No emails have been queued for this session.</p>
            ) : (
              [...byTemplate.entries()].map(([t, rows]) => (
                <p key={t}>
                  <span className="font-medium">{TEMPLATE[t] ?? t}:</span> <EmailCounts rows={rows} />
                </p>
              ))
            )}
            <p className="text-xs text-ink/60">Queued emails are delivered in the background. Track delivery in the cohort&apos;s Delivery tab.</p>
          </Card>
        </section>

        <section>
          <SectionTitle>Revision history</SectionTitle>
          {history.length === 0 ? (
            <p className="text-sm text-ink/60">No revisions yet. A snapshot is saved each time the session is published, edited or cancelled.</p>
          ) : (
            <ol className="space-y-1.5 border-l-2 border-line pl-4 text-sm">
              {history.map((h) => (
                <li key={h.revision + h.created_at.toString()}>
                  <span className="font-medium">Revision {h.revision}</span>
                  <span className="text-ink/60"> · {REV_STATE[h.state] ?? h.state} · {h.actor} · {formatInstant(h.created_at, s.timezone)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
