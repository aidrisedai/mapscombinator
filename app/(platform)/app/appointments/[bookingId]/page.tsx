import type { Metadata } from "next";
import { requestNow } from "@/components/office-hours/now";
import Link from "next/link";
import { BookingBadge } from "@/components/office-hours/badges";
import { toSlotView } from "@/components/office-hours/slots";
import { When } from "@/components/office-hours/When";
import { ActionButton } from "@/components/ui/forms";
import { Card, ExternalLink, KeyValue, Notice, PageHeader, Prose, SectionTitle } from "@/components/ui/primitives";
import { sql } from "@/lib/server/db";
import { availableSlots, cancellationPolicyText, getBooking } from "@/lib/server/domain/bookings";
import { getOrganization } from "@/lib/server/domain/organization";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { markOutcomeAction } from "./actions";
import { CancelBookingForm, RescheduleForm } from "./forms";

export const metadata: Metadata = { title: "Appointment" };

const EVENT: Record<string, string> = {
  created: "Booked",
  cancelled: "Cancelled",
  cancelled_override: "Cancelled by an administrator (inside the cancellation window)",
  rescheduled_from: "Moved to a new time",
  rescheduled_to: "Created by rescheduling",
  completed: "Marked completed",
  no_show: "Marked no-show",
};

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { bookingId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/app/appointments/${bookingId}`);
  const { booking: b, role, history } = await load(() => getBooking(account, bookingId));
  const now = requestNow();
  const startsAt = new Date(b.starts_at).getTime();
  const upcoming = b.state === "confirmed" && startsAt > now;
  const started = startsAt <= now;
  const windowMin = (b.policy_snapshot as { cancellationWindowMinutes: number }).cancellationWindowMinutes;
  const insideWindow = startsAt - now < windowMin * 60_000;
  const mode: "admin" | "founder" | "mentor" = role.admin ? "admin" : role.founder ? "founder" : "mentor";
  const meetingUrl: string | null = b.meeting_url ?? b.profile_url ?? null;
  const minutes = Math.round((new Date(b.ends_at).getTime() - startsAt) / 60000);
  const org = await getOrganization(sql(), account.organizationId);
  const support = role.access.cohort.supportEmail ?? org?.supportEmail ?? null;
  const canOutcome = (role.mentor || role.admin) && started && ["confirmed", "completed", "no_show"].includes(b.state);
  const canReschedule = upcoming && (mode === "admin" || (mode === "founder" && !insideWindow && role.access.cohort.status === "active"));
  const slots = canReschedule
    ? (await availableSlots(b.cohort_id, { mentorId: b.mentor_account_id })).filter((s) => s.id !== b.slot_id).map((s) => toSlotView(s as Parameters<typeof toSlotView>[0]))
    : [];
  const startupHref = `/app/cohorts/${b.cohort_id}/startups/${b.enrollment_id}`;

  return (
    <>
      <p className="mb-2 text-sm">
        {role.founder ? (
          <Link href={`/app/cohorts/${b.cohort_id}/office-hours?tab=appointments&team=${b.enrollment_id}`} className="font-medium text-emerald hover:text-forest">← My appointments</Link>
        ) : role.mentor ? (
          <Link href="/mentor/appointments" className="font-medium text-emerald hover:text-forest">← My mentor appointments</Link>
        ) : (
          <Link href={`/manage/cohorts/${b.cohort_id}/bookings`} className="font-medium text-emerald hover:text-forest">← Cohort bookings</Link>
        )}
      </p>
      <PageHeader eyebrow="Mentor appointment" title={b.topic} description={<BookingBadge state={b.state} />} />
      <div className="space-y-6">
        {one(sp.booked) === "1" && b.state === "confirmed" && (
          <Notice tone="success" title="Your appointment is confirmed">You and {b.mentor_name} will each get a confirmation email.</Notice>
        )}
        {one(sp.rescheduled) === "1" && b.state === "confirmed" && (
          <Notice tone="success" title="Appointment moved">The new time is confirmed and the previous time was released. Everyone involved is being emailed.</Notice>
        )}
        {b.state === "cancelled" && (
          <Notice tone="error" title="This appointment was cancelled">
            {b.replaced_by_booking_id ? (
              <>
                It was moved to a new time. <Link className="font-medium text-emerald hover:text-forest" href={`/app/appointments/${b.replaced_by_booking_id}`}>Open the new appointment</Link>.
              </>
            ) : (
              <>
                {b.cancelled_by_name ? `Cancelled by ${b.cancelled_by_name}` : "Cancelled"}
                {b.cancelled_at ? ` on ${formatInstant(b.cancelled_at, b.timezone)}` : ""}
                {b.cancellation_reason ? `. Reason: ${b.cancellation_reason}` : "."}
              </>
            )}
          </Notice>
        )}
        {b.replaces_booking_id && (
          <p className="text-sm text-ink/70">
            This appointment replaced an earlier time. <Link className="font-medium text-emerald hover:text-forest" href={`/app/appointments/${b.replaces_booking_id}`}>See the original</Link>.
          </p>
        )}

        <Card>
          <KeyValue
            items={[
              ["When", <When key="w" start={b.starts_at} end={b.ends_at} tz={b.timezone} strike={b.state === "cancelled"} />],
              ["Duration", `${minutes} minutes`],
              ["Mentor", b.mentor_name],
              ["Startup", <Link key="s" className="font-medium text-emerald hover:text-forest" href={startupHref}>{b.startup}</Link>],
              ["Cohort", b.cohort_name],
              ["Booked by", `${b.booked_by_name} on ${formatInstant(b.created_at, b.timezone)}`],
              ["Meeting link", meetingUrl && b.state === "confirmed" ? <ExternalLink key="m" href={meetingUrl}>{meetingUrl}</ExternalLink> : null],
              ["Location", b.location || null],
              ["Instructions", b.meeting_instructions ? <span key="i" className="whitespace-pre-line">{b.meeting_instructions}</span> : null],
              ["Cancellation policy", cancellationPolicyText({ cancellationWindowMinutes: windowMin })],
            ]}
          />
          {b.state === "confirmed" && !meetingUrl && !b.location && (
            <p className="mt-3 text-sm text-ink/70">The mentor hasn&apos;t added a meeting link or location yet. Reply to the confirmation email if you need details.</p>
          )}
        </Card>

        <section>
          <SectionTitle>The team&apos;s question</SectionTitle>
          <Card className="space-y-3">
            <p className="text-xs text-ink/60">Private to the team, the mentor and program administrators. It isn&apos;t posted in the cohort journal.</p>
            <p className="font-semibold text-ink">{b.topic}</p>
            {b.help_needed ? <Prose text={b.help_needed} /> : <p className="text-sm text-ink/60">No extra details were added.</p>}
            {b.link && (
              <p className="text-sm">
                Link: <ExternalLink href={b.link} />
              </p>
            )}
            <p className="text-sm">
              <Link className="font-medium text-emerald hover:text-forest" href={startupHref}>See {b.startup}&apos;s profile and journal →</Link>
            </p>
          </Card>
        </section>

        {upcoming && mode === "founder" && role.access.cohort.status !== "active" && (
          <Notice tone="info" title="This cohort is read-only">Changes can&apos;t be made here. Contact your program administrator{support ? ` at ${support}` : ""}.</Notice>
        )}
        {upcoming && mode === "founder" && role.access.cohort.status === "active" && insideWindow && (
          <Notice tone="warn" title="It's too close to the start time to change this here">
            Contact your program administrator{support ? (
              <>
                {" "}at <a className="font-medium text-emerald underline underline-offset-2" href={`mailto:${support}`}>{support}</a>
              </>
            ) : ""}{" "}
            if you need to cancel or move this appointment.
          </Notice>
        )}

        {canReschedule && (
          <section>
            <SectionTitle>Reschedule</SectionTitle>
            <Card className="space-y-3">
              <p className="text-sm text-ink/70">
                Pick another open time with {b.mentor_name}. The new time is reserved first; if it&apos;s no longer available, this appointment stays as it is.
                {mode === "admin" && insideWindow && " This is inside the founders' cancellation window, so it's recorded as an administrator override."}
              </p>
              <RescheduleForm bookingId={b.id} slots={slots} reasonRequired={mode === "admin" && !role.founder} />
            </Card>
          </section>
        )}

        {upcoming && (mode === "admin" || mode === "mentor" || (mode === "founder" && !insideWindow && role.access.cohort.status === "active")) && (
          <section>
            <SectionTitle>Cancel</SectionTitle>
            <Card className="space-y-3">
              {mode === "mentor" && (
                <p className="text-sm text-ink/70">
                  To move this meeting, cancel with a reason and ask the team to book another time — appointments are never moved without the founders choosing the new time.
                </p>
              )}
              {mode === "admin" && insideWindow && <p className="text-sm text-ink/70">This is inside the founders&apos; cancellation window; your cancellation is recorded as an administrator override.</p>}
              <CancelBookingForm
                bookingId={b.id}
                reasonRequired={mode !== "founder" && !role.founder}
                hint={mode === "founder" ? "Shared with the mentor." : "Required. Shared with the team in the cancellation email."}
              />
            </Card>
          </section>
        )}

        {canOutcome && (
          <section>
            <SectionTitle>Record the outcome</SectionTitle>
            <Card className="flex flex-wrap items-center gap-3">
              <p className="w-full text-sm text-ink/70">Only the team, the mentor and administrators see this. It isn&apos;t a rating.</p>
              <ActionButton action={markOutcomeAction} fields={{ bookingId: b.id, outcome: "completed" }} label={b.state === "completed" ? "Completed ✓" : "Mark completed"} variant={b.state === "completed" ? "primary" : "secondary"} size="md" />
              <ActionButton action={markOutcomeAction} fields={{ bookingId: b.id, outcome: "no_show" }} label={b.state === "no_show" ? "No-show ✓" : "Mark no-show"} variant={b.state === "no_show" ? "primary" : "secondary"} size="md" />
            </Card>
          </section>
        )}

        <section>
          <SectionTitle>History</SectionTitle>
          {history.length === 0 ? (
            <p className="text-sm text-ink/60">No changes recorded.</p>
          ) : (
            <ol className="space-y-2 border-l-2 border-line pl-4 text-sm">
              {history.map((h, i) => (
                <li key={i}>
                  <span className="font-medium text-ink">{EVENT[h.event] ?? h.event}</span>
                  <span className="text-ink/60"> · {h.actor} · {formatInstant(h.created_at, b.timezone)}</span>
                  {h.reason && <span className="block text-ink/70">Reason: {h.reason}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
