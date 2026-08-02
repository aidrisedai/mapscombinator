import type { Metadata } from "next";
import { siteConfig } from "@/content/site";
import { events } from "@/content/events";
import { EventCard } from "@/components/EventCard";
import { EmptyState } from "@/components/EmptyState";
import { SectionEyebrow } from "@/components/SectionEyebrow";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Founder gatherings, workshops, coworking, office hours, build weekends, and demo events for Greater Seattle's builder community.",
};

export default function EventsPage() {
  const verified = siteConfig.eventsEnabled
    ? events.filter((e) => e.verification.verified && e.status !== "Draft")
    : [];
  const upcoming = verified
    .filter((e) => !["Completed", "Cancelled"].includes(e.status))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const past = verified
    .filter((e) => e.status === "Completed")
    .sort((a, b) => b.startAt.localeCompare(a.startAt));

  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <SectionEyebrow>Events</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-forest md:text-5xl">
            What is happening at the center.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Attend an open gathering, bring a problem to a workshop, work
            alongside other builders, or see what teams have learned. Events
            are the easiest way to enter the community.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="font-display text-2xl font-bold text-forest">Upcoming</h2>
        <div className="mt-8">
          {upcoming.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-3">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyState
              message="The first events are being prepared. Join the founding community and we will send you the launch schedule when it is confirmed."
              ctaLabel="Join the Founding Community"
              ctaHref="/get-involved#join"
            />
          )}
        </div>

        {past.length > 0 && (
          <>
            <h2 className="mt-16 font-display text-2xl font-bold text-forest">
              Previously
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {past.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
