import type { Metadata } from "next";
import Link from "next/link";
import { BookingBadge, MODE_LABEL, SessionBadges, isUpdated } from "@/components/office-hours/badges";
import { When } from "@/components/office-hours/When";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle, Tabs, cx } from "@/components/ui/primitives";
import { requireCohortRead } from "@/lib/server/authz";
import { teamBookings } from "@/lib/server/domain/bookings";
import { MentorDirectory } from "@/components/mentors/MentorDirectory";
import { listWeeks } from "@/lib/server/domain/cohorts";
import { listSessions } from "@/lib/server/domain/office-hours";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import type { Account } from "@/lib/server/session";

export const metadata: Metadata = { title: "Office hours" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function OfficeHoursPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: SP }) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const tab = one(sp.tab) === "mentors" ? "mentors" : one(sp.tab) === "appointments" ? "appointments" : "sessions";
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/office-hours`);
  const base = `/app/cohorts/${cohortId}/office-hours`;
  return (
    <>
      <PageHeader
        title="Office hours"
        description="Join group sessions with the program team, or book a short one-to-one appointment with a mentor."
      />
      <Tabs
        current={tab}
        items={[
          { key: "sessions", href: `${base}?tab=sessions`, label: "Group sessions" },
          { key: "mentors", href: `${base}?tab=mentors`, label: "Book a mentor" },
          { key: "appointments", href: `${base}?tab=appointments`, label: "My appointments" },
        ]}
      />
      {tab === "sessions" && <SessionsTab account={account} cohortId={cohortId} past={one(sp.when) === "past"} />}
      {tab === "mentors" && <MentorDirectory account={account} cohortId={cohortId} />}
      {tab === "appointments" && <AppointmentsTab account={account} cohortId={cohortId} team={one(sp.team)} />}
    </>
  );
}

async function SessionsTab({ account, cohortId, past }: { account: Account; cohortId: string; past: boolean }) {
  const { access, sessions } = await load(() => listSessions(account, cohortId, { when: past ? "past" : "upcoming" }));
  const weeks = new Map((await listWeeks(cohortId)).map((w) => [w.id as string, w.number as number]));
  const base = `/app/cohorts/${cohortId}/office-hours`;
  // Readers never see drafts here; admins manage drafts in the Manage area.
  const visible = sessions.filter((s) => s.state !== "draft");
  return (
    <section aria-labelledby="sessions-h">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="sessions-h" className="text-base font-semibold text-ink">{past ? "Past sessions" : "Upcoming group sessions"}</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {past ? (
            <Link className="font-medium text-emerald hover:text-forest" href={`${base}?tab=sessions`}>← Upcoming sessions</Link>
          ) : (
            <Link className="font-medium text-emerald hover:text-forest" href={`${base}?tab=sessions&when=past`}>Past sessions</Link>
          )}
          {access.isAdmin && (
            <Link className="font-medium text-emerald hover:text-forest" href={`/manage/cohorts/${cohortId}/office-hours`}>Manage sessions</Link>
          )}
        </div>
      </div>
      <p className="mb-4 text-xs text-ink/60">Times are shown in the program timezone ({access.cohort.timezone.replaceAll("_", " ")}), with your local time underneath when it differs.</p>
      {visible.length === 0 ? (
        <EmptyState title={past ? "No past sessions yet" : "No upcoming group sessions"}>
          {past
            ? "Sessions appear here after they've taken place."
            : "When the program team schedules a session, it will appear here. In the meantime you can book a mentor."}
          {!past && (
            <div className="mt-4">
              <LinkButton href={`${base}?tab=mentors`} variant="secondary" size="sm">Book a mentor</LinkButton>
            </div>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => {
            const cancelled = s.state === "cancelled";
            const week = s.week_id ? weeks.get(s.week_id) : undefined;
            return (
              <Card as="li" key={s.id} className={cx(cancelled && "bg-cream/40")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`${base}/${s.id}`} className={cx("font-display text-lg font-bold text-forest hover:text-emerald", cancelled && "line-through decoration-error/60")}>
                        {s.title}
                      </Link>
                      <SessionBadges state={s.state} updated={isUpdated(s)} past={past} />
                    </div>
                    <When start={s.starts_at} end={s.ends_at} tz={s.timezone} strike={cancelled} className="text-sm" />
                    <p className="text-sm text-ink/70">
                      {[s.host_name && `Hosted by ${s.host_name}`, MODE_LABEL[s.mode], s.mode !== "online" && s.location].filter(Boolean).join(" · ")}
                      {week && (
                        <>
                          {" · "}
                          <Link className="font-medium text-emerald hover:text-forest" href={`/app/cohorts/${cohortId}/weeks/${week}`}>Week {week}</Link>
                        </>
                      )}
                    </p>
                    {cancelled && (
                      <p className="text-sm text-error">Cancelled{s.cancel_reason ? `: ${s.cancel_reason}` : "."}</p>
                    )}
                  </div>
                  <LinkButton href={`${base}/${s.id}`} variant="secondary" size="sm" className="shrink-0">Details</LinkButton>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </section>
  );
}

async function AppointmentsTab({ account, cohortId, team }: { account: Account; cohortId: string; team?: string }) {
  const access = await load(() => requireCohortRead(account, cohortId));
  const base = `/app/cohorts/${cohortId}/office-hours`;
  if (access.founderOf.length === 0)
    return (
      <EmptyState title="Appointments belong to startup teams">
        Founders book mentor appointments for their startup, and see them here.{" "}
        {access.isMentor ? (
          <>
            Your own mentor appointments are under <Link className="font-medium text-emerald hover:text-forest" href="/mentor/appointments">Mentor → Appointments</Link>.
          </>
        ) : access.isAdmin ? (
          <>
            All of this cohort&apos;s bookings are in <Link className="font-medium text-emerald hover:text-forest" href={`/manage/cohorts/${cohortId}/bookings`}>Manage → Bookings</Link>.
          </>
        ) : null}
      </EmptyState>
    );
  const current = access.founderOf.find((f) => f.enrollmentId === team) ?? access.founderOf[0];
  const [upcoming, past] = await Promise.all([
    load(() => teamBookings(account, cohortId, current.enrollmentId, "upcoming")),
    load(() => teamBookings(account, cohortId, current.enrollmentId, "past")),
  ]);
  const list = (rows: typeof upcoming, emptyText: string) =>
    rows.length === 0 ? (
      <p className="rounded-md border border-dashed border-line bg-cream/40 px-4 py-6 text-center text-sm text-ink/70">{emptyText}</p>
    ) : (
      <ul className="divide-y divide-line/70 rounded-lg border border-line/80">
        {rows.map((b) => (
          <li key={b.id}>
            <Link href={`/app/appointments/${b.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-cream/50 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="block font-semibold text-forest">{b.topic}</span>
                <span className="block text-sm text-ink/70">with {b.mentor_name} · booked by {b.booked_by_name}</span>
                <When start={b.starts_at} end={b.ends_at} tz={b.timezone} className="text-sm" strike={b.state === "cancelled"} />
              </span>
              <BookingBadge state={b.state} />
            </Link>
          </li>
        ))}
      </ul>
    );
  return (
    <section className="space-y-6">
      {access.founderOf.length > 1 && (
        <nav aria-label="Choose startup" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink/60">Startup:</span>
          {access.founderOf.map((f) => (
            <Link
              key={f.enrollmentId}
              href={`${base}?tab=appointments&team=${f.enrollmentId}`}
              aria-current={f.enrollmentId === current.enrollmentId ? "page" : undefined}
              className={cx(
                "rounded-full border px-3 py-1 font-medium",
                f.enrollmentId === current.enrollmentId ? "border-forest bg-forest text-paper" : "border-line text-ink/70 hover:border-forest hover:text-forest",
              )}
            >
              {f.startupName}
            </Link>
          ))}
        </nav>
      )}
      <p className="text-sm text-ink/70">
        Appointments for <strong>{current.startupName}</strong>. Everyone on your team can see and manage them. Statuses are visible only to your team, the mentor and program administrators.
      </p>
      <div>
        <SectionTitle action={<LinkButton href={`${base}?tab=mentors`} size="sm" variant="secondary">Book a mentor</LinkButton>}>Upcoming</SectionTitle>
        {list(upcoming, "No upcoming appointments. Book a mentor when you need a second opinion.")}
      </div>
      <div>
        <SectionTitle>Past and cancelled</SectionTitle>
        {list(past, "Nothing here yet.")}
      </div>
    </section>
  );
}
