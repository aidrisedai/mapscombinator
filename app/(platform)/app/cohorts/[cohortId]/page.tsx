import type { Metadata } from "next";
import Link from "next/link";
import { UpdateCard } from "@/components/journal/UpdateCard";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader, Prose, SectionTitle } from "@/components/ui/primitives";
import { requireCohortRead } from "@/lib/server/authz";
import { sql } from "@/lib/server/db";
import { listAnnouncements } from "@/lib/server/domain/announcements";
import { teamBookings } from "@/lib/server/domain/bookings";
import { listSessions } from "@/lib/server/domain/office-hours";
import { getUpdateForPeriod, listJournal } from "@/lib/server/domain/updates";
import { getWeekForReader } from "@/lib/server/domain/weeks";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { addDays, formatDate, formatTimeRange, todayIn, weekNumberFor } from "@/lib/time";

export const metadata: Metadata = { title: "Home" };

export default async function CohortHome({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}`);
  const a = await load(() => requireCohortRead(account, cohortId));
  const c = a.cohort;
  const today = todayIn(c.timezone);
  const weekNo = weekNumberFor(c.startDate, c.weekCount, today);
  const team = a.founderOf.find((f) => f.enrollmentId === one(sp.team)) ?? a.founderOf[0] ?? null;
  const base = `/app/cohorts/${cohortId}`;

  const [week, sessions, announcements] = await Promise.all([
    weekNo ? getWeekForReader(account, cohortId, weekNo) : null,
    listSessions(account, cohortId, { when: "upcoming", limit: 3 }),
    listAnnouncements(account, cohortId, { limit: 3 }),
  ]);
  const writable = c.status === "active" && weekNo !== null;
  const todayDaily = team && writable ? await getUpdateForPeriod(account, cohortId, team.enrollmentId, "daily", { reportDate: today }) : null;
  const thisWeekly = team && writable ? await getUpdateForPeriod(account, cohortId, team.enrollmentId, "weekly", { weekNumber: weekNo! }) : null;
  const appointments = team ? await teamBookings(account, cohortId, team.enrollmentId, "upcoming") : [];
  const recent = !team ? (await listJournal(account, cohortId, {})).items.slice(0, 4) : [];
  const [counts] = await sql()`select count(*)::int as startups from enrollments where cohort_id = ${cohortId} and status = 'active'`;
  const teamQ = team && a.founderOf.length > 1 ? `&team=${team.enrollmentId}` : "";

  return (
    <>
      <PageHeader
        eyebrow={team ? team.startupName : c.name}
        title={weekNo ? `Week ${weekNo} of ${c.weekCount}` : today < c.startDate ? `Starts ${formatDate(c.startDate)}` : "Program complete"}
        description={weekNo ? `${formatDate(addDays(c.startDate, (weekNo - 1) * 7))} – ${formatDate(addDays(c.startDate, (weekNo - 1) * 7 + 6))} · ${c.timezone.replace("_", " ")}` : `${c.weekCount} weeks from ${formatDate(c.startDate)}`}
      />
      {one(sp.welcome) && team && (
        <div className="mb-6">
          <Notice tone="success" title={`Welcome to ${team.startupName}'s home`}>
            Each day, post a short update — it takes about a minute. At the end of the week, write a summary together. Drafts are private to your team and visible to program administrators for support; published updates are shared with the cohort.
          </Notice>
        </div>
      )}
      {a.founderOf.length > 1 && (
        <nav aria-label="Your startups" className="mb-6 flex flex-wrap gap-2 text-sm">
          {a.founderOf.map((f) => (
            <Link key={f.enrollmentId} href={`${base}?team=${f.enrollmentId}`} aria-current={f.enrollmentId === team?.enrollmentId ? "page" : undefined} className={`rounded-full border px-3 py-1 ${f.enrollmentId === team?.enrollmentId ? "border-forest bg-forest text-paper" : "border-line hover:border-forest"}`}>
              {f.startupName}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {team && (
            <Card className="border-forest/30 bg-cream/40">
              <SectionTitle>Today · {formatDate(today)}</SectionTitle>
              {!writable ? (
                <p className="text-sm text-ink/70">{c.status === "active" ? "There's no program week today." : c.status === "draft" ? "Posting opens when the cohort is activated." : "This cohort has ended; its history is read-only."}</p>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    {todayDaily?.state === "published" ? (
                      <p><Badge tone="published">Posted</Badge> <span className="ml-2 text-ink/70">Today&apos;s update is live.</span></p>
                    ) : todayDaily ? (
                      <p><Badge tone="draft">Draft</Badge> <span className="ml-2 text-ink/70">Saved but not published yet.</span></p>
                    ) : (
                      <p className="text-ink/70">No update for today yet.</p>
                    )}
                    <p className="mt-2 text-ink/60">
                      Week {weekNo} summary: {thisWeekly?.state === "published" ? "published" : thisWeekly ? "draft saved" : "not started"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <LinkButton href={`${base}/updates/new?kind=daily${teamQ}`}>
                      {todayDaily?.state === "published" ? "Edit today's update" : todayDaily ? "Continue draft" : "Write daily update"}
                    </LinkButton>
                    <LinkButton variant="secondary" href={`${base}/updates/new?kind=weekly&week=${weekNo}${teamQ}`}>
                      {thisWeekly ? "Open weekly summary" : "Write weekly summary"}
                    </LinkButton>
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card>
            <SectionTitle action={weekNo ? <Link href={`${base}/weeks/${weekNo}`} className="text-sm font-medium text-emerald hover:text-forest">Open guide →</Link> : undefined}>
              This week&apos;s expectations
            </SectionTitle>
            {week?.content ? (
              <div className="space-y-3">
                <p className="font-display text-lg font-bold text-forest">{week.content.title}</p>
                {week.content.objective && <Prose text={week.content.objective} />}
                {week.content.deliverable && (
                  <p className="text-sm"><span className="font-semibold">Deliverable: </span>{week.content.deliverable}</p>
                )}
                {week.resources.length > 0 && <p className="text-xs text-ink/60">{week.resources.length} resource{week.resources.length === 1 ? "" : "s"} attached</p>}
              </div>
            ) : (
              <p className="text-sm text-ink/60">{weekNo ? "The program team hasn't published this week's guide yet." : "No current program week."}</p>
            )}
          </Card>

          {team ? (
            <div className="text-sm">
              <Link className="font-medium text-emerald hover:text-forest" href={`${base}/startups/${team.enrollmentId}`}>Your team&apos;s timeline →</Link>
              <span className="mx-2 text-ink/30">·</span>
              <Link className="font-medium text-emerald hover:text-forest" href={`${base}/journal`}>See what other startups are doing →</Link>
            </div>
          ) : (
            <section>
              <SectionTitle action={<Link href={`${base}/journal`} className="text-sm font-medium text-emerald hover:text-forest">Full journal →</Link>}>Recent updates</SectionTitle>
              {recent.length === 0 ? (
                <EmptyState title="No published updates yet">{counts.startups === 0 ? "No startups are enrolled yet." : "Updates appear here as teams publish them."}</EmptyState>
              ) : (
                <div className="space-y-4">{recent.map((u) => <UpdateCard key={u.id} u={u} cohortId={cohortId} tz={c.timezone} compact />)}</div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <SectionTitle action={<Link href={`${base}/office-hours`} className="text-sm font-medium text-emerald hover:text-forest">All →</Link>}>Upcoming office hours</SectionTitle>
            {sessions.sessions.length === 0 ? (
              <p className="text-sm text-ink/60">No upcoming group sessions.</p>
            ) : (
              <ul className="space-y-3">
                {sessions.sessions.map((s) => (
                  <li key={s.id} className="text-sm">
                    <Link href={`${base}/office-hours/${s.id}`} className={`font-medium hover:text-emerald ${s.state === "cancelled" ? "line-through text-ink/50" : "text-forest"}`}>{s.title}</Link>
                    {s.state === "cancelled" && <span className="ml-2"><Badge tone="danger">Cancelled</Badge></span>}
                    {s.state === "draft" && <span className="ml-2"><Badge tone="draft">Draft</Badge></span>}
                    <p className="text-ink/60">{formatTimeRange(s.starts_at, s.ends_at, s.timezone)}</p>
                  </li>
                ))}
              </ul>
            )}
            {team && (
              <p className="mt-4 border-t border-line pt-3 text-sm">
                <Link href={`${base}/office-hours?tab=mentors`} className="font-medium text-emerald hover:text-forest">Book a mentor →</Link>
              </p>
            )}
          </Card>
          {team && (
            <Card>
              <SectionTitle>Your appointments</SectionTitle>
              {appointments.length === 0 ? (
                <p className="text-sm text-ink/60">No upcoming mentor appointments.</p>
              ) : (
                <ul className="space-y-3">
                  {appointments.map((b) => (
                    <li key={b.id} className="text-sm">
                      <Link href={`/app/appointments/${b.id}`} className="font-medium text-forest hover:text-emerald">{b.mentor_name}</Link>
                      <p className="text-ink/60">{formatTimeRange(b.starts_at, b.ends_at, b.timezone)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          <Card>
            <SectionTitle action={<Link href={`${base}/announcements`} className="text-sm font-medium text-emerald hover:text-forest">All →</Link>}>Announcements</SectionTitle>
            {announcements.announcements.length === 0 ? (
              <p className="text-sm text-ink/60">No announcements right now.</p>
            ) : (
              <ul className="space-y-3">
                {announcements.announcements.map((n) => (
                  <li key={n.id} className="border-l-2 border-forest pl-3 text-sm">
                    <p className="font-medium">{n.pinned && <span className="mr-1 text-emerald">Pinned ·</span>}{n.title}</p>
                    <p className="line-clamp-2 text-ink/60">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
