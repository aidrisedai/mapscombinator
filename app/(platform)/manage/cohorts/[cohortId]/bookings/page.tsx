import type { Metadata } from "next";
import { requestNow } from "@/components/office-hours/now";
import Link from "next/link";
import { BookingBadge } from "@/components/office-hours/badges";
import { When } from "@/components/office-hours/When";
import { Card, EmptyState, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { cancellationPolicyText, cohortBookings, getPolicy, listCohortMentors } from "@/lib/server/domain/bookings";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { PolicyForm } from "./PolicyForm";

export const metadata: Metadata = { title: "Manage bookings" };

export default async function ManageBookingsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/bookings`);
  await load(() => requireCohortAdmin(account, cohortId));
  const [policy, bookings, { mentors }] = await Promise.all([getPolicy(cohortId), load(() => cohortBookings(account, cohortId)), load(() => listCohortMentors(account, cohortId))]);
  const now = requestNow();
  const upcoming = bookings.filter((b) => b.state === "confirmed" && new Date(b.ends_at).getTime() >= now).reverse();
  const rest = bookings.filter((b) => !(b.state === "confirmed" && new Date(b.ends_at).getTime() >= now));
  const table = (rows: (typeof bookings)[number][]) => (
    <ul className="divide-y divide-line/70 rounded-lg border border-line/80">
      {rows.map((b) => (
        <li key={b.id}>
          <Link href={`/app/appointments/${b.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-cream/50 sm:flex-row sm:items-start sm:justify-between">
            <span className="min-w-0">
              <span className="block font-semibold text-forest">{b.startup} with {b.mentor_name}</span>
              <span className="block text-sm text-ink/70">{b.topic} · booked by {b.booked_by_name}</span>
              <When start={b.starts_at} end={b.ends_at} tz={b.timezone} className="text-sm" strike={b.state === "cancelled"} />
            </span>
            <BookingBadge state={b.state} />
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <PageHeader title="Mentor bookings" description="The cohort's booking rules and every appointment. Open an appointment to cancel or reschedule it with a reason." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <section>
            <SectionTitle>Upcoming ({upcoming.length})</SectionTitle>
            {upcoming.length === 0 ? (
              <EmptyState title="No upcoming appointments">When founders book mentors, appointments appear here. Make sure mentors have published availability.</EmptyState>
            ) : (
              table(upcoming)
            )}
          </section>
          <section>
            <SectionTitle>Past and cancelled</SectionTitle>
            {rest.length === 0 ? <p className="text-sm text-ink/60">Nothing here yet.</p> : table(rest)}
            <p className="mt-2 text-xs text-ink/60">Statuses are visible only to the startup, its mentor and administrators.</p>
          </section>
        </div>
        <div className="space-y-8">
          <section>
            <SectionTitle>Booking policy</SectionTitle>
            <Card className="space-y-4">
              <Notice tone="info" title="Proposed defaults — the program can change them">
                Changes apply to new bookings only. Existing appointments keep the policy they were booked under.
              </Notice>
              <p className="text-sm text-ink/70">Founders currently see: “{cancellationPolicyText(policy)}”</p>
              <PolicyForm
                cohortId={cohortId}
                allowedDurations={policy.allowedDurations}
                horizonDays={policy.horizonDays}
                cancellationWindowMinutes={policy.cancellationWindowMinutes}
                activeBookingLimit={policy.activeBookingLimit}
              />
            </Card>
          </section>
          <section>
            <SectionTitle>Mentor availability</SectionTitle>
            {mentors.length === 0 ? (
              <p className="text-sm text-ink/60">No mentors in this cohort yet. Invite them from Members.</p>
            ) : (
              <ul className="divide-y divide-line/70 rounded-lg border border-line/80 text-sm">
                {mentors.map((raw) => {
                  const m = raw as typeof raw & { id: string; display_name: string };
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <span>
                        <span className="font-medium">{m.display_name}</span>
                        <span className="ml-2 text-ink/60">{m.nextSlots.length ? "Has open times" : "No open times"}</span>
                      </span>
                      <span className="flex gap-3">
                        <Link className="font-medium text-emerald hover:text-forest" href={`/mentor/availability?mentor=${m.id}`}>Manage availability</Link>
                        <Link className="font-medium text-emerald hover:text-forest" href={`/mentor/appointments?mentor=${m.id}`}>Appointments</Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink/60">You can manage availability on a mentor&apos;s behalf; changes are recorded as yours.</p>
          </section>
        </div>
      </div>
    </>
  );
}
