import type { Metadata } from "next";
import Link from "next/link";
import { BookingBadge } from "@/components/office-hours/badges";
import { When } from "@/components/office-hours/When";
import { EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { mentorBookingsFor } from "@/lib/server/domain/bookings";
import { load } from "@/lib/server/page";
import { mentorPage, NotAMentor, OnBehalfBanner } from "../context";

export const metadata: Metadata = { title: "Mentor appointments" };

export default async function MentorAppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { account, ctx, q } = await mentorPage("/mentor/appointments", await searchParams);
  if (!ctx) return <NotAMentor />;
  const [upcoming, past] = await Promise.all([
    load(() => mentorBookingsFor(account, ctx.mentor.id, "upcoming")),
    load(() => mentorBookingsFor(account, ctx.mentor.id, "past")),
  ]);
  const who = ctx.self ? "your" : `${ctx.mentor.displayName}'s`;
  const list = (rows: typeof upcoming, empty: React.ReactNode) =>
    rows.length === 0 ? (
      empty
    ) : (
      <ul className="divide-y divide-line/70 rounded-lg border border-line/80">
        {rows.map((b) => (
          <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <Link href={`/app/appointments/${b.id}`} className="block font-semibold text-forest hover:text-emerald">{b.topic}</Link>
              <p className="text-sm text-ink/70">
                <Link className="font-medium text-emerald hover:text-forest" href={`/app/cohorts/${b.cohort_id}/startups/${b.enrollment_id}`}>{b.startup}</Link>
                {" · "}
                {b.cohort_name} · booked by {b.booked_by_name}
              </p>
              <When start={b.starts_at} end={b.ends_at} tz={b.timezone} className="text-sm" strike={b.state === "cancelled"} />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <BookingBadge state={b.state} />
              <LinkButton href={`/app/appointments/${b.id}`} size="sm" variant="secondary">Open</LinkButton>
            </div>
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <PageHeader
        title="Appointments"
        description={`Upcoming and past one-to-one appointments booked with ${ctx.self ? "you" : ctx.mentor.displayName}. Open one to see the team's question, cancel with a reason, or record the outcome.`}
      />
      <OnBehalfBanner ctx={ctx} />
      <div className="space-y-8">
        <section>
          <SectionTitle>Upcoming</SectionTitle>
          {list(
            upcoming,
            <EmptyState
              title="No upcoming appointments"
              action={<LinkButton href={`/mentor/availability${q}`} variant="secondary" size="sm">Manage availability</LinkButton>}
            >
              Founders can book {who} open times. Add or extend availability so teams can find a slot.
            </EmptyState>,
          )}
        </section>
        <section>
          <SectionTitle>Past and cancelled</SectionTitle>
          {list(past, <p className="text-sm text-ink/60">Nothing here yet.</p>)}
        </section>
      </div>
      {!ctx.self && <p className="mt-6 text-xs text-ink/50">Signed in as {account.displayName}. Only appointments in cohorts you administer are shown.</p>}
    </>
  );
}
