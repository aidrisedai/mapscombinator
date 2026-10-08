import Link from "next/link";
import { When } from "@/components/office-hours/When";
import { Card, EmptyState, LinkButton, Notice, SectionTitle } from "@/components/ui/primitives";
import { listCohortMentors } from "@/lib/server/domain/bookings";
import { load } from "@/lib/server/page";
import type { Account } from "@/lib/server/session";
import { MentorLinks } from "./MentorLinks";

/** Mentor/advisor cards for one cohort: profile summary, links and next open times. */
export async function MentorDirectory({ account, cohortId }: { account: Account; cohortId: string }) {
  const { access, mentors } = await load(() => listCohortMentors(account, cohortId));
  const canBook = access.founderOf.length > 0;
  return (
    <section aria-labelledby="mentors-h">
      <SectionTitle>
        <span id="mentors-h">Mentors and advisors in {access.cohort.name}</span>
      </SectionTitle>
      <p className="mb-4 text-sm text-ink/70">
        {canBook
          ? "Pick a mentor to see their full profile and contact details, and book a short appointment for your team."
          : "Founders book mentor appointments for their startup. You can browse mentors and their open times."}{" "}
        Availability is managed on this platform; no external calendar is checked.
      </p>
      {access.cohort.status !== "active" && (
        <div className="mb-4">
          <Notice tone="info" title="Booking is closed">
            {access.cohort.status === "draft" ? "Mentor booking opens when the program is activated." : "This cohort has ended, so new appointments can't be booked."}
          </Notice>
        </div>
      )}
      {mentors.length === 0 ? (
        <EmptyState title="No mentors yet">
          {access.isAdmin
            ? "Invite mentors from the cohort's Members page. Once they add availability, founders can book them here."
            : "When the program adds mentors to this cohort, they'll appear here with their open times."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {mentors.map((raw) => {
            const m = raw as typeof raw & { id: string; display_name: string; headline: string | null; bio: string | null; expertise: string[] | null; interests: string | null };
            const href = `/app/cohorts/${cohortId}/mentors/${m.id}`;
            const tags = (m.expertise as string[] | null) ?? [];
            const bio = (m.bio as string | null) ?? "";
            return (
              <Card as="li" key={m.id} className="flex flex-col gap-3">
                <div>
                  <Link href={href} className="font-display text-lg font-bold text-forest hover:text-emerald">{m.display_name}</Link>
                  {m.headline && <p className="text-sm text-ink/70">{m.headline}</p>}
                  {tags.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Expertise">
                      {tags.map((t) => (
                        <li key={t} className="rounded-full bg-cream px-2 py-0.5 text-xs font-medium text-ink/80">{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {bio && <p className="text-sm text-ink/80">{bio.length > 220 ? `${bio.slice(0, 220).trimEnd()}…` : bio}</p>}
                {m.interests && (
                  <p className="text-sm text-ink/80">
                    <span className="font-semibold text-ink">Interested in: </span>
                    {m.interests.length > 160 ? `${m.interests.slice(0, 160).trimEnd()}…` : m.interests}
                  </p>
                )}
                <MentorLinks m={m} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Next available</p>
                  {m.nextSlots.length === 0 ? (
                    <p className="mt-1 text-sm text-ink/60">No open times right now. Check back later.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {m.nextSlots.map((s) => (
                        <li key={new Date(s.starts_at).toISOString()}>
                          <When start={s.starts_at} end={s.ends_at} tz={s.timezone} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-auto">
                  <LinkButton href={href} variant={canBook && m.nextSlots.length ? "primary" : "secondary"} size="sm">
                    {canBook && m.nextSlots.length ? "See times and book" : "View profile"}
                  </LinkButton>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </section>
  );
}
