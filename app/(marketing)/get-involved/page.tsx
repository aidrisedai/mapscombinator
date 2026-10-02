import type { Metadata } from "next";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { ContributionCard } from "@/components/ContributionCard";
import { GetInvolvedForm } from "@/components/GetInvolvedForm";
import { EthicsNotice } from "@/components/EthicsNotice";

export const metadata: Metadata = {
  title: "Get Involved",
  description:
    "Mentor a team, offer a pilot opportunity, volunteer, or sponsor a specific program need — how Greater Seattle contributes to MAPS Combinator.",
};

const PATHS = [
  {
    id: "mentor",
    title: "Mentor or hold office hours",
    copy: "Share practical experience in a defined area — engineering, sales, pricing, operations, finance, hiring. Good mentorship asks precise questions, challenges assumptions, and helps a team reach a concrete next step within the 12 weeks.",
    ctaLabel: "Offer Expertise",
    ctaHref: "#contribute",
  },
  {
    id: "pilot-partner",
    title: "Be a customer or pilot partner",
    copy: "Give teams access to a real problem in your business, school, clinic, nonprofit, or agency — plus a responsible testing environment and honest feedback. A credible local pilot is worth more to a team than another pitch event.",
    ctaLabel: "Propose a Problem or Pilot",
    ctaHref: "#contribute",
  },
  {
    id: "volunteer",
    title: "Volunteer",
    copy: "Help run cohort sessions: operations, participant experience, documentation, outreach, photography, or logistics — through a clearly scoped role with a defined time commitment.",
    ctaLabel: "Volunteer",
    ctaHref: "#contribute",
  },
  {
    id: "sponsor",
    title: "Sponsor or partner",
    copy: "Fund a specific, measurable program need — a workshop series, tooling, a scholarship seat, or Demo Day. Sponsorship must preserve program integrity: it buys real value for teams, not influence over selection.",
    ctaLabel: "Discuss Sponsorship",
    ctaHref: "#contribute",
  },
];

export default function GetInvolvedPage() {
  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <SectionEyebrow>Get Involved</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-forest md:text-5xl">
            The program runs on contributions from Greater Seattle.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Each cohort needs four things from the local community: mentors
            with real operating experience, organizations that offer teams
            real problems and honest pilots, volunteers who keep sessions
            running, and sponsors who fund specific program needs. Every
            contribution flows directly into the teams — and the ventures they
            build stay pointed at local problems.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="grid gap-6 md:grid-cols-2">
          {PATHS.map((path) => (
            <ContributionCard key={path.id} {...path} />
          ))}
        </div>
      </section>

      <section id="contribute" className="scroll-mt-24 bg-cream/70 py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="font-display text-3xl font-bold text-forest">
            Offer a contribution
          </h2>
          <p className="mt-4 leading-relaxed text-ink/85">
            Tell us what you can offer and we will follow up as the matching
            program pieces are confirmed — mentor rosters, pilot-partner
            slots, volunteer roles, and sponsorship packages are finalized
            before the cohort opens.
          </p>
          <div className="mt-8">
            <EthicsNotice>
              Your information is used only to coordinate contributions and
              share program news. No spam. No public listing without separate
              consent.
            </EthicsNotice>
          </div>
          <div className="mt-10 rounded-lg border border-line bg-paper p-7 md:p-9">
            <GetInvolvedForm />
          </div>
        </div>
      </section>
    </>
  );
}
