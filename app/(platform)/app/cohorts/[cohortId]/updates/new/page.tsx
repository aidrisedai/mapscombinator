import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, Notice, PageHeader, Prose } from "@/components/ui/primitives";
import { requireCohortRead } from "@/lib/server/authz";
import { dailyNotesForWeek, getUpdateForPeriod, LIMITS, previousCommitments } from "@/lib/server/domain/updates";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { addDays, formatDate, isIsoDate, todayIn, weekNumberFor } from "@/lib/time";
import { Composer } from "./Composer";

export const metadata: Metadata = { title: "Write update" };

export default async function NewUpdatePage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/updates/new`);
  const a = await load(() => requireCohortRead(account, cohortId));
  const c = a.cohort;
  if (!a.founderOf.length)
    return <EmptyState title="Only founders post updates">Updates are written by each startup&apos;s founders. You can read published updates in the journal.</EmptyState>;
  if (c.status !== "active")
    return <EmptyState title="Posting is closed">{c.status === "draft" ? "This cohort hasn't started yet." : "This cohort has ended; its history is read-only."}</EmptyState>;

  const team = a.founderOf.find((f) => f.enrollmentId === one(sp.team)) ?? a.founderOf[0];
  const kind = one(sp.kind) === "weekly" ? "weekly" : "daily";
  const today = todayIn(c.timezone);
  const lastDay = addDays(c.startDate, c.weekCount * 7 - 1);
  const maxDate = today < lastDay ? today : lastDay;
  const reqDate = one(sp.date);
  const date = reqDate && isIsoDate(reqDate) && reqDate <= maxDate && reqDate >= c.startDate ? reqDate : maxDate;
  const currentWeek = weekNumberFor(c.startDate, c.weekCount, maxDate) ?? 1;
  const reqWeek = Number(one(sp.week));
  const week = Number.isInteger(reqWeek) && reqWeek >= 1 && reqWeek <= currentWeek ? reqWeek : currentWeek;

  if (today < c.startDate)
    return <EmptyState title="The program starts soon">Updates open on {formatDate(c.startDate)}.</EmptyState>;

  const existing = await load(() => getUpdateForPeriod(account, cohortId, team.enrollmentId, kind, kind === "daily" ? { reportDate: date } : { weekNumber: week }));
  const notes = kind === "weekly" ? await dailyNotesForWeek(account, cohortId, team.enrollmentId, week) : [];
  const prev = kind === "weekly" ? await previousCommitments(account, cohortId, team.enrollmentId, week) : null;
  const base = `/app/cohorts/${cohortId}/updates/new?team=${team.enrollmentId}`;

  return (
    <>
      <PageHeader
        eyebrow={team.startupName}
        title={kind === "daily" ? "Daily update" : `Weekly summary · Week ${week}`}
        description={
          kind === "daily"
            ? "A minute is enough: what moved, what's next, and where you're stuck."
            : "Look back on the week as a team. This is written by you — nothing is generated from your daily notes."
        }
        actions={
          <div className="flex rounded-md border border-line p-0.5 text-sm" role="group" aria-label="Update type">
            <Link href={`${base}&kind=daily`} aria-current={kind === "daily" ? "page" : undefined} className={`rounded px-3 py-1.5 font-medium ${kind === "daily" ? "bg-forest text-paper" : "text-ink/70 hover:text-forest"}`}>Daily</Link>
            <Link href={`${base}&kind=weekly`} aria-current={kind === "weekly" ? "page" : undefined} className={`rounded px-3 py-1.5 font-medium ${kind === "weekly" ? "bg-forest text-paper" : "text-ink/70 hover:text-forest"}`}>Weekly</Link>
          </div>
        }
      />
      {a.founderOf.length > 1 && (
        <nav aria-label="Startup" className="mb-6 flex flex-wrap gap-2 text-sm">
          {a.founderOf.map((f) => (
            <Link key={f.enrollmentId} href={`/app/cohorts/${cohortId}/updates/new?team=${f.enrollmentId}&kind=${kind}`} aria-current={f.enrollmentId === team.enrollmentId ? "page" : undefined} className={`rounded-full border px-3 py-1 ${f.enrollmentId === team.enrollmentId ? "border-forest bg-forest text-paper" : "border-line hover:border-forest"}`}>
              {f.startupName}
            </Link>
          ))}
        </nav>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <Composer
            key={`${team.enrollmentId}:${kind}:${kind === "daily" ? date : week}`}
            cohortId={cohortId}
            enrollmentId={team.enrollmentId}
            kind={kind}
            period={kind === "daily" ? { reportDate: date } : { weekNumber: week }}
            periodPicker={kind === "daily" ? { kind: "date", min: c.startDate, max: maxDate, value: date, hrefBase: `${base}&kind=daily&date=` } : { kind: "week", max: currentWeek, value: week, hrefBase: `${base}&kind=weekly&week=` }}
            existing={existing}
            limits={kind === "daily" ? LIMITS.daily : LIMITS.weekly}
            journalHref={`/app/cohorts/${cohortId}/startups/${team.enrollmentId}`}
          />
        </div>
        <aside className="space-y-4">
          <Notice tone="info" title="Who sees this">
            Drafts are visible to your team and the cohort&apos;s administrators (for support). Published updates are visible to everyone in this cohort.
          </Notice>
          {kind === "weekly" && (
            <>
              <Card>
                <h2 className="text-sm font-semibold">This week&apos;s commitments</h2>
                <p className="mt-1 text-xs text-ink/60">From your Week {week - 1} summary, for reference.</p>
                {prev ? <Prose className="mt-3" text={prev.text} /> : <p className="mt-3 text-sm text-ink/60">No commitments recorded for the previous week.</p>}
              </Card>
              <Card>
                <h2 className="text-sm font-semibold">Your daily notes this week</h2>
                {notes.length === 0 ? (
                  <p className="mt-2 text-sm text-ink/60">No daily notes for Week {week} yet.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {notes.map((n) => (
                      <li key={n.id} className="border-l-2 border-line pl-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatDate(n.reportDate!)}</span>
                          <Badge tone={n.state === "published" ? "published" : "draft"}>{n.state === "published" ? "Published" : "Private draft"}</Badge>
                        </div>
                        {n.content.moved && <p className="mt-1 whitespace-pre-line text-ink/80">{n.content.moved}</p>}
                        {n.content.next && <p className="mt-1 whitespace-pre-line text-ink/60">Next: {n.content.next}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
