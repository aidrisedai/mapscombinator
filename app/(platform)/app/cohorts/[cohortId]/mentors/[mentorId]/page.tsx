import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, Notice, PageHeader, Prose, SectionTitle } from "@/components/ui/primitives";
import { cancellationPolicyText, getCohortMentor } from "@/lib/server/domain/bookings";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { toSlotView, type SlotView } from "@/components/office-hours/slots";
import { BookingFlow } from "./BookingFlow";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { aiConfigured } from "@/lib/server/ai/assistant";

export const metadata: Metadata = { title: "Mentor" };

export default async function MentorPage({ params }: { params: Promise<{ cohortId: string; mentorId: string }> }) {
  const { cohortId, mentorId } = await params;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/mentors/${mentorId}`);
  const { access, mentor, slots, policy } = await load(() => getCohortMentor(account, cohortId, mentorId));
  const views = slots.map((s) => toSlotView(s as Parameters<typeof toSlotView>[0]));
  const tags = (mentor.expertise as string[] | null) ?? [];
  const isFounder = access.founderOf.length > 0;
  const open = access.cohort.status === "active";
  const backHref = `/app/cohorts/${cohortId}/office-hours?tab=mentors`;
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={backHref} className="font-medium text-emerald hover:text-forest">← All mentors</Link>
      </p>
      <PageHeader eyebrow="Mentor" title={mentor.display_name} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <Card>
            {tags.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Expertise">
                {tags.map((t) => (
                  <li key={t} className="rounded-full bg-cream px-2 py-0.5 text-xs font-medium text-ink/80">{t}</li>
                ))}
              </ul>
            )}
            {mentor.bio ? <Prose text={mentor.bio} /> : <p className="text-sm text-ink/60">This mentor hasn&apos;t added a bio yet.</p>}
            {mentor.timezone && <p className="mt-4 text-xs text-ink/60">Usually works in {String(mentor.timezone).replaceAll("_", " ")}.</p>}
          </Card>
          <Notice tone="info" title="How availability works">
            The times shown are managed on this platform by the mentor and the program team. No external calendar is checked. A time is reserved only once your booking is confirmed.
          </Notice>
        </div>
        <section aria-labelledby="book-h">
          <SectionTitle>
            <span id="book-h">{isFounder && open ? "Book an appointment" : "Open times"}</span>
          </SectionTitle>
          {!open ? (
            <div className="space-y-4">
              <Notice tone="info" title="Booking is closed">
                {access.cohort.status === "draft" ? "Mentor booking opens when the program is activated." : "This cohort has ended, so new appointments can't be booked."}
              </Notice>
            </div>
          ) : isFounder ? (
            <>
              <AiAssistant kind="booking" ctx={{ cohortId, enrollmentId: access.founderOf[0]?.enrollmentId, mentorId: mentor.id }} target="#ai-target-booking" configured={aiConfigured()} audience="founder" title="Prepare your question with AI" intro="Pick a time first, then tell me what you want help with. I draft the topic and question for you to check." placeholder="e.g. We can't decide between charging clinics per seat or per volunteer shift" />
              <div id="ai-target-booking">
                <BookingFlow
                cohortId={cohortId}
                cohortName={access.cohort.name}
                mentorName={mentor.display_name}
                slots={views}
                teams={access.founderOf.map((f) => ({ enrollmentId: f.enrollmentId, startupName: f.startupName }))}
                policyText={cancellationPolicyText(policy)}
                meetingInstructions={mentor.meeting_instructions ?? ""}
              />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Notice tone="info" title="Only founders book appointments">
                Founders book mentor time for their startup. You can see this mentor&apos;s open times below.
              </Notice>
              {views.length === 0 ? (
                <EmptyState title="No open times right now">The mentor hasn&apos;t published availability for this cohort within the booking window.</EmptyState>
              ) : (
                <ReadOnlySlots slots={views} />
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ReadOnlySlots({ slots }: { slots: SlotView[] }) {
  const groups = new Map<string, SlotView[]>();
  for (const s of slots) groups.set(s.dateKey, [...(groups.get(s.dateKey) ?? []), s]);
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([k, list]) => (
        <div key={k}>
          <h3 className="mb-1.5 text-sm font-semibold text-ink">{list[0].dateLabel}</h3>
          <ul className="flex flex-wrap gap-2">
            {list.map((s) => (
              <li key={s.id} className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink/80">{s.timeLabel}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
