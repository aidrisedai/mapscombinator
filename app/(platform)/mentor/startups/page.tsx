import type { Metadata } from "next";
import Link from "next/link";
import { UpdateCard } from "@/components/journal/UpdateCard";
import { Badge, Card, EmptyState, ExternalLink, PageHeader, Prose, SectionTitle, cx } from "@/components/ui/primitives";
import { advisorDigest } from "@/lib/server/domain/advisors";
import { load, one } from "@/lib/server/page";
import { formatDate } from "@/lib/time";
import { mentorPage, NotAMentor, OnBehalfBanner } from "../context";

export const metadata: Metadata = { title: "Startups" };

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const chip = (active: boolean) =>
  cx("rounded-full border px-3 py-1 text-xs font-semibold", active ? "border-forest bg-forest text-paper" : "border-line bg-paper text-ink/70 hover:border-forest hover:text-forest");

export default async function AdvisorStartupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { account, ctx, q } = await mentorPage("/mentor/startups", sp);
  if (!ctx) return <NotAMentor />;
  const cohorts = ctx.cohorts as { id: string; name: string }[];
  if (cohorts.length === 0) return <NotAMentor />;
  const requested = one(sp.cohort);
  const cohortId = cohorts.some((c) => c.id === requested) ? requested! : cohorts[0].id;
  const d = await load(() => advisorDigest(account, cohortId, { week: Number(one(sp.week)) || undefined, date: one(sp.date) }));
  const tz = d.access.cohort.timezone;
  const href = (p: { cohort?: string; week?: number; date?: string }) => {
    const u = new URLSearchParams(q.replace(/^\?/, ""));
    u.set("cohort", p.cohort ?? cohortId);
    if (p.week) u.set("week", String(p.week));
    if (p.date) u.set("date", p.date);
    return `/mentor/startups?${u.toString()}`;
  };
  const appBase = `/app/cohorts/${cohortId}`;
  const posted = d.teams.filter((t) => t.daily).length;
  const weeklyPosted = d.teams.filter((t) => t.weekly).length;
  const g = d.guide.content as Record<string, string> | null;

  return (
    <>
      <PageHeader title="Startups" description="Every team's published daily updates and weekly summaries, with this week's guide and materials. Drafts are never shown." />
      <OnBehalfBanner ctx={ctx} />
      {cohorts.length > 1 && (
        <nav aria-label="Cohort" className="mb-5 flex flex-wrap gap-2">
          {cohorts.map((c) => (
            <Link key={c.id} href={href({ cohort: c.id })} className={chip(c.id === cohortId)} aria-current={c.id === cohortId ? "page" : undefined}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold text-forest">
            Week {d.week} <span className="text-base font-normal text-ink/60">of {d.weekCount}</span>
          </p>
          <p className="text-sm text-ink/70">
            {formatDate(d.range.startDate)} – {formatDate(d.range.endDate)} · {d.access.cohort.name}
            {d.week === d.currentWeek && <> · <strong className="text-emerald">this week</strong></>}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {d.week > 1 && <Link className="rounded-md border border-line px-3 py-1.5 font-medium text-forest hover:border-forest" href={href({ week: d.week - 1 })}>← Week {d.week - 1}</Link>}
          {d.week !== d.currentWeek && <Link className="rounded-md border border-line px-3 py-1.5 font-medium text-forest hover:border-forest" href={href({ week: d.currentWeek })}>This week</Link>}
          {d.week < d.weekCount && <Link className="rounded-md border border-line px-3 py-1.5 font-medium text-forest hover:border-forest" href={href({ week: d.week + 1 })}>Week {d.week + 1} →</Link>}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <section aria-labelledby="daily-h">
            <SectionTitle>
              <span id="daily-h">Daily updates · {dayLabel(d.date)}</span>
            </SectionTitle>
            <nav aria-label="Day" className="mb-4 flex flex-wrap gap-2">
              {d.days.map((day) => (
                <Link key={day} href={href({ week: d.week, date: day })} className={chip(day === d.date)} aria-current={day === d.date ? "page" : undefined}>
                  {dayLabel(day)}
                  {day === d.today ? " · today" : ""}
                </Link>
              ))}
            </nav>
            <p className="mb-4 text-sm text-ink/70">{posted} of {d.teams.length} startup{d.teams.length === 1 ? "" : "s"} posted for this day.</p>
            {d.teams.length === 0 ? (
              <EmptyState title="No startups yet">Startups appear here once the program team enrolls them.</EmptyState>
            ) : (
              <div className="space-y-4">
                {d.teams.map((t) =>
                  t.daily ? (
                    <UpdateCard key={t.id} u={t.daily} cohortId={cohortId} tz={tz} />
                  ) : (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-line px-5 py-3 text-sm">
                      <Link href={`${appBase}/startups/${t.id}`} className="font-semibold text-forest hover:text-emerald">{t.name}</Link>
                      <span className="text-ink/50">No update for this day</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="weekly-h">
            <SectionTitle>
              <span id="weekly-h">Weekly summaries · Week {d.week}</span>
            </SectionTitle>
            <p className="mb-4 text-sm text-ink/70">{weeklyPosted} of {d.teams.length} posted.</p>
            <div className="space-y-4">
              {d.teams.map((t) =>
                t.weekly ? (
                  <UpdateCard key={t.id} u={t.weekly} cohortId={cohortId} tz={tz} />
                ) : (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-line px-5 py-3 text-sm">
                    <Link href={`${appBase}/startups/${t.id}`} className="font-semibold text-forest hover:text-emerald">{t.name}</Link>
                    <span className="text-ink/50">Weekly summary not posted yet</span>
                  </div>
                ),
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <Card>
            <SectionTitle>This week&apos;s materials</SectionTitle>
            {!g ? (
              <p className="text-sm text-ink/60">The program team hasn&apos;t published the Week {d.week} guide yet.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {g.title && <p className="font-display text-lg font-bold text-forest">{g.title}</p>}
                {g.objective && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Objective</p>
                    <Prose text={g.objective} />
                  </div>
                )}
                {g.deliverable && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Deliverable teams are working on</p>
                    <Prose text={g.deliverable} />
                  </div>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/60">To review</p>
                  {d.guide.resources.length === 0 ? (
                    <p className="text-ink/60">No slides or files for this week.</p>
                  ) : (
                    <ul className="space-y-2">
                      {d.guide.resources.map((r) => (
                        <li key={r.id as string}>
                          {r.kind === "file" ? (
                            <a href={`/api/files/${r.id}`} className="font-medium text-emerald underline underline-offset-2 hover:text-forest">{r.label as string}</a>
                          ) : (
                            <ExternalLink href={r.url as string}>{r.label as string}</ExternalLink>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p>
                  <Link href={`${appBase}/weeks/${d.week}`} className="font-medium text-emerald hover:text-forest">Open the full Week {d.week} guide →</Link>
                </p>
              </div>
            )}
          </Card>
          <Card>
            <SectionTitle>Startups this week</SectionTitle>
            <ul className="divide-y divide-line/60 text-sm">
              {d.teams.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0">
                  <Link href={`${appBase}/startups/${t.id}`} className="font-medium text-forest hover:text-emerald">{t.name}</Link>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{t.dailiesThisWeek} daily</Badge>
                    {t.weekly ? <Badge tone="published">Weekly ✓</Badge> : <Badge tone="warn">No weekly</Badge>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink/60">
              Open a startup for its full timeline, or see everything in the <Link href={`${appBase}/journal`} className="font-medium text-emerald hover:text-forest">cohort journal</Link>.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
