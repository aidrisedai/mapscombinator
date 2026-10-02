import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig, stageCopy } from "@/content/site";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { EthicsNotice } from "@/components/EthicsNotice";

export const metadata: Metadata = {
  title: "The Program",
  description:
    "The full MAPS Combinator program: weekly rhythm, what MAPS provides, venture standards, selection process, and how success is measured.",
};

const RHYTHM = [
  "Scheduled in-person build time",
  "Weekly accountability review",
  "Practitioner office hours",
  "Customer discovery and testing between sessions",
  "Evidence log updated every week",
  "Midpoint review",
  "Final Demo Day or evidence review",
];

const CONFIRMED_BENEFITS = [
  "Scheduled workspace access during published hours",
  "Reliable internet during program sessions",
  "Weekly accountability sessions",
  "Mentor and specialist office hours",
  "Educational templates and operating resources",
  "Demo Day or final evidence review",
];

const CONDITIONAL_BENEFITS = [
  "Cloud or software credits subject to provider eligibility and approval",
  "External introductions based on fit and readiness",
  "Legal, tax, finance, or incorporation referrals",
  "Prototyping tools through partner organizations",
  "Continued workspace after the cohort",
];

const SELECTION_STEPS = [
  { title: "Interest form", copy: "Basic fit and launch updates." },
  {
    title: "Application",
    copy: "Founder, problem, evidence, artifact, commitment, and ethical considerations.",
  },
  {
    title: "Working interview or build challenge",
    copy: "Evaluate coachability, evidence, contribution, and execution.",
  },
  {
    title: "Final selection",
    copy: "Cohort fit, capacity, safety, and commitment.",
  },
];

const SUCCESS_MEASURES = [
  "Teams completing the cohort",
  "Customer or stakeholder conversations with documented learning",
  "Tested artifacts or working products",
  "Real users, pilots, preorders, revenue, or adoption signals appropriate to the venture",
  "Teams making a well-supported go, pivot, or stop decision",
  "Alumni returning as mentors, employers, sponsors, or contributors",
  "Participant quality, safety, and ethical decision-making",
];

export default function ProgramPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-forest text-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <p className="inline-block rounded-full border border-moss/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            12-week pilot · Equity-free · Status: {siteConfig.combinatorStatus}
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight md:text-5xl">
            Stop polishing the idea. Start testing what must be true.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cream/90">
            This page states exactly what the program involves, what MAPS
            provides, how teams are selected, and how success is measured — so
            applicants, mentors, and partners know precisely what they are
            committing to.
          </p>
          <div className="mt-9">
            <Link
              href={stageCopy.primaryCta.href}
              className="inline-block rounded-full bg-cream px-7 py-3.5 font-semibold text-forest transition-colors hover:bg-paper"
            >
              {stageCopy.primaryCta.label}
            </Link>
          </div>
        </div>
      </section>

      {/* Weekly rhythm */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionEyebrow>The commitment</SectionEyebrow>
            <h2 className="font-display text-3xl font-bold text-forest">
              Weekly operating rhythm
            </h2>
            <p className="mt-5 leading-relaxed text-ink/85">
              This is a working program, not a lecture series. Participants
              should expect a meaningful weekly commitment, including in-person
              build time and work with users between sessions. Final hours and
              attendance requirements will be published before applications
              open.
            </p>
          </div>
          <ul className="space-y-3">
            {RHYTHM.map((item) => (
              <li
                key={item}
                className="flex items-baseline gap-3 border-b border-line pb-3 text-ink/85"
              >
                <span aria-hidden="true" className="text-emerald">
                  —
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What MAPS may provide */}
      <section className="bg-cream/60 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-bold text-forest">
            What MAPS may provide
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-line bg-paper p-7">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald">
                Confirmed when the cohort opens
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-ink/85">
                {CONFIRMED_BENEFITS.map((item) => (
                  <li key={item} className="flex items-baseline gap-2.5">
                    <span aria-hidden="true" className="text-success">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-line bg-paper p-7">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
                Conditional and never guaranteed
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-ink/85">
                {CONDITIONAL_BENEFITS.map((item) => (
                  <li key={item} className="flex items-baseline gap-2.5">
                    <span aria-hidden="true" className="text-ink/40">
                      ○
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Venture standards */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="font-display text-3xl font-bold text-forest">
          Venture standards
        </h2>
        <p className="mt-5 max-w-2xl leading-relaxed text-ink/85">
          Participating ventures must align with MAPS community standards and
          ethical guardrails. The program will not support businesses centered
          on gambling, predatory or interest-based financial practices,
          deception, exploitation, pornography, harmful surveillance, illegal
          activity, or products whose foreseeable harms fundamentally outweigh
          their benefit.
        </p>
        <div className="mt-6 max-w-2xl">
          <EthicsNotice title="Fair review">
            Standards are applied through a fair review and appeal process.
            Complex cases are reviewed with qualified religious, legal, domain,
            and risk advisors — not decided casually by a single mentor.
          </EthicsNotice>
        </div>
      </section>

      {/* Selection */}
      <section className="bg-cream/60 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-bold text-forest">
            Selection process
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {SELECTION_STEPS.map((step, i) => (
              <li key={step.title} className="border-t-2 border-emerald pt-4">
                <span className="font-display text-lg font-bold text-emerald">
                  {i + 1}
                </span>
                <h3 className="mt-1 font-semibold text-forest">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">
                  {step.copy}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink/70">
            A hackathon or pitch competition may provide a priority interview —
            never automatic admission.
          </p>
        </div>
      </section>

      {/* Success */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="font-display text-3xl font-bold text-forest">
          What success means
        </h2>
        <p className="mt-5 max-w-2xl leading-relaxed text-ink/85">
          Success is not measured in pitch decks or incorporated companies. The
          program tracks:
        </p>
        <ul className="mt-6 max-w-2xl space-y-2.5">
          {SUCCESS_MEASURES.map((item) => (
            <li
              key={item}
              className="flex items-baseline gap-3 border-b border-line pb-2.5 text-ink/85"
            >
              <span aria-hidden="true" className="text-emerald">
                —
              </span>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-10 max-w-2xl">
          <EthicsNotice title="Required disclaimer">
            Participation does not guarantee company formation, product
            success, customers, revenue, grants, investment, credits,
            introductions, or continued facility access. Program details and
            benefits may change before the cohort opens. Educational content is
            not legal, tax, or financial advice.
          </EthicsNotice>
        </div>
        <div className="mt-10">
          <Link
            href={stageCopy.primaryCta.href}
            className="inline-block rounded-full bg-forest px-7 py-3.5 font-semibold text-paper transition-colors hover:bg-emerald"
          >
            {stageCopy.primaryCta.label}
          </Link>
        </div>
      </section>
    </>
  );
}
