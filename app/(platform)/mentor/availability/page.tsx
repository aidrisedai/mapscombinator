import type { Metadata } from "next";
import { DateTime } from "luxon";
import { Card, EmptyState, ExternalLink, KeyValue, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { listRules } from "@/lib/server/domain/mentors";
import { load } from "@/lib/server/page";
import { formatDate, todayIn } from "@/lib/time";
import { mentorPage, NotAMentor, OnBehalfBanner } from "../context";
import { ExceptionForm } from "./ExceptionForm";
import { RetireRule } from "./RetireRule";
import { RuleForm } from "./RuleForm";
import { CalendarLinkForm } from "./CalendarLinkForm";

export const metadata: Metadata = { title: "Availability" };

const WEEKDAY = ["", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];
const t12 = (hhmmss: string) => DateTime.fromFormat(hhmmss.slice(0, 5), "HH:mm").toFormat("h:mm a");

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { account, ctx } = await mentorPage("/mentor/availability", await searchParams);
  if (!ctx) return <NotAMentor />;
  const { rules, exceptions } = await load(() => listRules(account, ctx.mentor.id));
  const tz = (ctx.profile?.timezone as string | undefined) ?? "America/Los_Angeles";
  const today = todayIn(tz);
  const openCohorts = ctx.cohorts.filter((c) => c.status === "active" || c.status === "draft").map((c) => ({ id: c.id as string, name: c.name as string }));
  return (
    <>
      <PageHeader title="Availability" description="How founders book time with you: through your own booking link, through times you publish here, or both." />
      <OnBehalfBanner ctx={ctx} />
      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Option 1: Use your own booking link</SectionTitle>
          <p className="mb-4 text-sm text-ink/70">
            Already use Calendly or another scheduler? Add the link and founders get a <strong>Book on their calendar</strong> button on your profile. Your calendar handles availability, reminders and video links.
          </p>
          <CalendarLinkForm mentorId={ctx.mentor.id} calendarUrl={(ctx.profile?.calendar_url as string | null) ?? ""} />
        </Card>
        <Card>
          <SectionTitle>Option 2: Publish times on the platform</SectionTitle>
          <p className="text-sm text-ink/70">
            Add a weekly window or single dates below. Founders book a time and add their question, and both of you get confirmation emails. Each time is one reservation shared across your cohorts.
          </p>
          <div className="mt-4">
            <Notice tone="info" title="Platform times don't read your external calendar">
              Block any time you can&apos;t attend. Changing availability never cancels or moves an existing appointment.
            </Notice>
          </div>
        </Card>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <section>
            <SectionTitle>Active availability</SectionTitle>
            {rules.length === 0 ? (
              <EmptyState title="No availability yet">Add a weekly window or a single date with the form, preview the times, then publish them so founders can book.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {rules.map((r) => (
                  <Card as="li" key={r.id} className="space-y-3">
                    <p className="font-semibold text-ink">
                      {r.kind === "weekly" ? `${WEEKDAY[r.weekday]} · ${formatDate(r.start_date)} – ${formatDate(r.end_date)}` : formatDate(r.start_date)}
                    </p>
                    <KeyValue
                      items={[
                        ["Window", `${t12(r.start_time)} – ${t12(r.end_time)} (${String(r.timezone).replaceAll("_", " ")} time)`],
                        ["Appointments", `${r.duration_minutes} min${r.buffer_minutes ? `, ${r.buffer_minutes} min buffer after each` : ", no buffer"}`],
                        ["Bookable", `up to ${r.horizon_days} days ahead`],
                        ["Cohorts", (r.cohort_names as string[]).join(", ") || "None"],
                        ["Open times", `${r.upcoming_slots} upcoming`],
                        ["Location", r.location || null],
                        ["Meeting link", r.meeting_url ? <ExternalLink key="m" href={r.meeting_url} /> : null],
                      ]}
                    />
                    <RetireRule mentorId={ctx.mentor.id} ruleId={r.id} />
                  </Card>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle>Exceptions</SectionTitle>
            <p className="mb-3 text-sm text-ink/70">Block a day you can&apos;t make, or replace that day&apos;s window with different hours. Existing appointments stay booked unless you cancel them.</p>
            {exceptions.length === 0 ? (
              <p className="mb-4 text-sm text-ink/60">No upcoming exceptions.</p>
            ) : (
              <ul className="mb-5 divide-y divide-line/70 rounded-lg border border-line/80 text-sm">
                {exceptions.map((x) => (
                  <li key={x.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                    <span className="font-medium">{formatDate(x.local_date)}</span>
                    <span className="text-ink/70">{x.kind === "unavailable" ? "Unavailable all day" : `Only ${t12(x.start_time)} – ${t12(x.end_time)}`}</span>
                  </li>
                ))}
              </ul>
            )}
            <Card>
              <ExceptionForm mentorId={ctx.mentor.id} timezone={tz} today={today} />
            </Card>
          </section>
        </div>

        <section>
          <SectionTitle>Add availability</SectionTitle>
          {openCohorts.length === 0 ? (
            <EmptyState title="No open cohorts">{ctx.self ? "Your" : "This mentor's"} cohorts have ended, so new availability can&apos;t be offered.</EmptyState>
          ) : (
            <Card>
              <RuleForm mentorId={ctx.mentor.id} defaultTimezone={tz} today={today} cohorts={openCohorts} />
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
