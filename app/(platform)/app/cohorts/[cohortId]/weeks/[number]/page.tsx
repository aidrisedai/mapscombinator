import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, ExternalLink, Notice, PageHeader, Prose, SectionTitle } from "@/components/ui/primitives";
import { listSessions } from "@/lib/server/domain/office-hours";
import { getWeekForReader } from "@/lib/server/domain/weeks";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatDate, formatInstant, formatTimeRange } from "@/lib/time";

export const metadata: Metadata = { title: "Weekly guide" };

const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function WeekPage({ params, searchParams }: { params: Promise<{ cohortId: string; number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId, number } = await params;
  const sp = await searchParams;
  const n = Number(number);
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/weeks/${number}`);
  const w = await load(() => getWeekForReader(account, cohortId, Number.isInteger(n) ? n : -1, one(sp.preview) === "1"));
  const sessions = (await listSessions(account, cohortId, { when: "upcoming", weekId: w.week.id })).sessions.concat((await listSessions(account, cohortId, { when: "past", weekId: w.week.id })).sessions);
  const tz = w.access.cohort.timezone;
  const nav = (
    <div className="flex gap-2 text-sm">
      {n > 1 && <Link className="font-medium text-emerald hover:text-forest" href={`/app/cohorts/${cohortId}/weeks/${n - 1}`}>← Week {n - 1}</Link>}
      {n < w.access.cohort.weekCount && <Link className="font-medium text-emerald hover:text-forest" href={`/app/cohorts/${cohortId}/weeks/${n + 1}`}>Week {n + 1} →</Link>}
    </div>
  );
  return (
    <>
      <PageHeader eyebrow={`Week ${n} · ${formatDate(w.week.start_date)} – ${formatDate(w.week.end_date)}`} title={w.content?.title || `Week ${n}`} actions={nav} />
      {w.isPreview && (
        <div className="mb-6"><Notice tone="warn" title="Preview as founder">You&apos;re seeing the latest draft. Founders only see this after it&apos;s published{w.week.content_state === "published" ? " (the published version may differ)" : ""}.</Notice></div>
      )}
      {!w.content ? (
        <EmptyState title="Not published yet">The program team hasn&apos;t published this week&apos;s guide. Check back soon.</EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            {w.content.objective && (
              <Card>
                <SectionTitle>Objective</SectionTitle>
                <Prose text={w.content.objective} />
              </Card>
            )}
            {w.content.instructions && (
              <Card>
                <SectionTitle>Expected work</SectionTitle>
                <Prose text={w.content.instructions} />
              </Card>
            )}
            {w.content.deliverable && (
              <Card className="border-forest/30 bg-cream/40">
                <SectionTitle>Deliverable / discussion prep</SectionTitle>
                <Prose text={w.content.deliverable} />
              </Card>
            )}
            {w.week.published_at && !w.isPreview && (
              <p className="text-xs text-ink/50">
                {w.week.first_published_at && new Date(w.week.published_at).getTime() - new Date(w.week.first_published_at).getTime() > 60_000 ? `Updated ${formatInstant(w.week.published_at, tz)}` : `Published ${formatInstant(w.week.published_at, tz)}`}
              </p>
            )}
          </div>
          <aside className="space-y-6">
            <Card>
              <SectionTitle>Slides & resources</SectionTitle>
              {w.resources.length === 0 ? (
                <p className="text-sm text-ink/60">No resources for this week.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {w.resources.map((r) => (
                    <li key={r.id}>
                      {r.kind === "file" ? (
                        <>
                          <a href={`/api/files/${r.id}`} className="font-medium text-emerald underline underline-offset-2 hover:text-forest">{r.label}</a>
                          <p className="text-xs text-ink/50">{r.filename} · {String(r.filename).toLowerCase().endsWith(".pdf") ? "PDF" : "PowerPoint"} · {size(Number(r.size_bytes))}</p>
                          <p className="text-xs"><a className="text-ink/60 underline" href={`/api/files/${r.id}?download=1`}>Download</a></p>
                        </>
                      ) : (
                        <>
                          <ExternalLink href={r.url}>{r.label}</ExternalLink>
                          <p className="text-xs text-ink/50">External link — access is controlled by the site it points to.</p>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <SectionTitle>Office hours this week</SectionTitle>
              {sessions.length === 0 ? (
                <p className="text-sm text-ink/60">No sessions linked to this week.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <Link href={`/app/cohorts/${cohortId}/office-hours/${s.id}`} className={`font-medium hover:text-emerald ${s.state === "cancelled" ? "text-ink/50 line-through" : "text-forest"}`}>{s.title}</Link>
                      {s.state === "cancelled" && <span className="ml-2"><Badge tone="danger">Cancelled</Badge></span>}
                      <p className="text-ink/60">{formatTimeRange(s.starts_at, s.ends_at, s.timezone)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}
