import type { Metadata } from "next";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { ContributionCard } from "@/components/ContributionCard";
import { InterestForm } from "@/components/InterestForm";
import { EthicsNotice } from "@/components/EthicsNotice";

export const metadata: Metadata = {
  title: "Get Involved",
  description:
    "Join as a builder, offer mentorship, become a pilot partner, volunteer, sponsor, or express Entrepreneur in Residence interest at the MAPS Center.",
};

const PATHS = [
  {
    id: "mentor",
    title: "Offer office hours or mentorship",
    copy: "Share practical experience in a defined area. Good mentorship asks precise questions, challenges assumptions, and helps a builder reach a concrete next step.",
    ctaLabel: "Offer Expertise",
    ctaHref: "#join",
  },
  {
    id: "pilot-partner",
    title: "Become a customer or pilot partner",
    copy: "Give builders access to real problems, responsible testing environments, and honest feedback. A credible pilot can be more valuable than another pitch event.",
    ctaLabel: "Propose a Community Challenge",
    ctaHref: "#join",
  },
  {
    id: "volunteer",
    title: "Volunteer",
    copy: "Help with event operations, participant experience, documentation, outreach, photography, logistics, or program delivery through a clearly scoped role.",
    ctaLabel: "See Volunteer Needs",
    ctaHref: "#join",
  },
  {
    id: "sponsor",
    title: "Sponsor or partner",
    copy: "Support a specific program, event, tool, scholarship, or builder resource. Sponsorship must preserve program integrity and should fund measurable value rather than vague visibility.",
    ctaLabel: "Discuss Partnership",
    ctaHref: "/contact",
  },
  {
    id: "eir",
    title: "Express EIR interest",
    copy: "Active founders interested in building publicly, holding office hours, sharing progress, and helping others may join the EIR interest list. Benefits and responsibilities will be published before selection.",
    ctaLabel: "Express EIR Interest",
    ctaHref: "#join",
  },
];

export default function GetInvolvedPage() {
  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <SectionEyebrow>Get Involved</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-forest md:text-5xl">
            You do not need to be a founder to help build the ecosystem.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Strong ventures require customers, engineers, designers, operators,
            mentors, researchers, funders, institutions, volunteers, and people
            willing to open the right door. Choose the contribution that
            matches your experience and availability.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="flex flex-col rounded-lg border-2 border-forest bg-paper p-7 md:col-span-2">
            <h2 className="font-display text-2xl font-bold text-forest">
              Join as a builder
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink/85">
              Tell us what you are building, the next evidence you need, and
              where the community may help.
            </p>
            <a
              href="#join"
              className="mt-5 inline-block self-start rounded-full bg-forest px-6 py-3 text-sm font-semibold text-paper hover:bg-emerald"
            >
              Join the Founding Community
            </a>
          </article>
          {PATHS.map((path) => (
            <ContributionCard key={path.id} {...path} />
          ))}
        </div>
      </section>

      <section id="join" className="scroll-mt-24 bg-cream/70 py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="font-display text-3xl font-bold text-forest">
            Join the founding community
          </h2>
          <p className="mt-4 leading-relaxed text-ink/85">
            One focused form for every path — builder, mentor, volunteer,
            partner, or supporter. Choose your primary relationship to building
            and tell us how you would like to contribute; we will follow up
            with the right next step.
          </p>
          <div className="mt-8">
            <EthicsNotice>
              We will use your information only to understand the community and
              share relevant updates. No spam. No public directory listing
              without separate consent.
            </EthicsNotice>
          </div>
          <div className="mt-10 rounded-lg border border-line bg-paper p-7 md:p-9">
            <InterestForm />
          </div>
        </div>
      </section>
    </>
  );
}
