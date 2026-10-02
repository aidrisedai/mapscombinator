import Link from "next/link";
import { siteConfig, stageCopy } from "@/content/site";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { SoundContour } from "@/components/SoundContour";
import { EthicsNotice } from "@/components/EthicsNotice";
import { CombinatorInterestForm } from "@/components/CombinatorInterestForm";

const FACTS = [
  { label: "Length", value: "12 weeks" },
  { label: "Equity taken", value: "0%" },
  { label: "Stage", value: "Early — idea to first users" },
  { label: "Location", value: "Greater Seattle" },
  { label: "Status", value: siteConfig.combinatorStatus },
];

const CONTRIBUTIONS = [
  {
    title: "Ventures built on local problems",
    copy: "Every team must identify a specific affected customer and test with real users — starting with the people, businesses, and institutions of Greater Seattle. The program's output is ventures that solve problems people here actually have.",
  },
  {
    title: "Practical skills that stay local",
    copy: "Participants learn customer discovery, product building, testing, and basic operations by doing. That capability remains in the region whether or not a given venture continues.",
  },
  {
    title: "A working mentorship loop",
    copy: "Local operators, engineers, and founders contribute office hours during the cohort. Alumni are expected to return as mentors, employers, pilot partners, or sponsors for the cohorts after them.",
  },
  {
    title: "Honest standards, no hype",
    copy: "Equity-free, evidence-driven, and ethically screened. Ventures are judged on real user behavior and community benefit — not pitch polish. Teams whose ideas do not hold up are helped to a responsible stop, not paraded.",
  },
];

const IS_IS_NOT: [string, string][] = [
  ["A 12-week early-stage incubator", "An accelerator or investment fund"],
  ["Equity-free — MAPS takes no ownership", "A claim on your company"],
  [
    "Evidence-driven — real users, real tests",
    "A pitch competition or demo theater",
  ],
  [
    "A disciplined path to a clear next-stage decision",
    "A guarantee of funding, customers, or success",
  ],
];

const PARTICIPANT_WORK = [
  {
    title: "Define the problem and beachhead customer",
    copy: "Identify a specific affected person, the context in which the problem occurs, existing alternatives, urgency, and the reason a new solution may deserve adoption.",
  },
  {
    title: "Replace assumptions with evidence",
    copy: "Conduct direct discovery, observe behavior, test willingness to act or pay, and record what changed in the team's understanding.",
  },
  {
    title: "Build the smallest useful product",
    copy: "Create an artifact that can generate learning: a prototype, workflow, service, pilot, technical proof, or working product.",
  },
  {
    title: "Test adoption and distribution",
    copy: "Put the product in front of real users. Test activation, repeat use, pricing, referrals, purchasing, partnerships, or another behavior appropriate to the venture.",
  },
  {
    title: "Build an operating foundation",
    copy: "Learn the basics of team agreements, ownership, intellectual property, incorporation choices, finance, responsible data use, and risk.",
  },
  {
    title: "Make a clear next-stage decision",
    copy: "At Demo Day, teams present the problem, evidence, product, learning, and next step — growth, an external accelerator, continued bootstrapping, a pivot, or a responsible stop.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-cream">
        <SoundContour className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full text-emerald/60" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 md:pb-28 md:pt-24">
          <SectionEyebrow>{stageCopy.heroEyebrow}</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-forest md:text-6xl">
            Twelve weeks to turn a real problem into a working venture.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            MAPS Combinator is a selective, equity-free incubator for
            early-stage teams in Greater Seattle. Participants validate a
            problem that matters, build and test a useful product with real
            users, and leave with a clear next-stage decision — creating
            ventures that serve the communities around them.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href={stageCopy.primaryCta.href}
              className="rounded-full bg-forest px-7 py-3.5 font-semibold text-paper transition-colors hover:bg-emerald"
            >
              {stageCopy.primaryCta.label}
            </Link>
            <Link
              href="/#how-it-works"
              className="rounded-full border border-forest px-7 py-3.5 font-semibold text-forest transition-colors hover:bg-forest hover:text-paper"
            >
              See How It Works
            </Link>
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
            {FACTS.map((fact) => (
              <div key={fact.label} className="bg-paper/90 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink/50">
                  {fact.label}
                </dt>
                <dd className="mt-1 font-display text-lg font-bold text-forest">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* What this returns to the community */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionEyebrow>Why it matters here</SectionEyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
          A program that pays its way back to Greater Seattle.
        </h2>
        <p className="mt-5 max-w-2xl leading-relaxed text-ink/85">
          The point of MAPS Combinator is not startups for their own sake. It
          is a repeatable way for this region to turn local problems, local
          talent, and local mentorship into useful ventures — and to make each
          cohort strengthen the community that hosts it.
        </p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
          {CONTRIBUTIONS.map((item) => (
            <div key={item.title} className="bg-paper p-7 md:p-9">
              <h3 className="font-display text-xl font-bold text-forest">
                {item.title}
              </h3>
              <p className="mt-3 leading-relaxed text-ink/85">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Precision: what it is / is not */}
      <section className="bg-cream/60 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <SectionEyebrow>Plain terms</SectionEyebrow>
          <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
            What MAPS Combinator is — and is not.
          </h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-b-2 border-forest pb-3 pr-6 font-display text-lg text-forest"
                  >
                    It is
                  </th>
                  <th
                    scope="col"
                    className="border-b-2 border-forest pb-3 font-display text-lg text-forest"
                  >
                    It is not
                  </th>
                </tr>
              </thead>
              <tbody>
                {IS_IS_NOT.map(([is, isNot]) => (
                  <tr key={is}>
                    <td className="border-b border-line py-3.5 pr-6 align-top text-ink/85">
                      {is}
                    </td>
                    <td className="border-b border-line py-3.5 align-top text-ink/70">
                      {isNot}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-8 max-w-2xl border-l-2 border-emerald pl-4 text-sm leading-relaxed text-ink/75">
            Participation does not guarantee funding, customers, incorporation,
            credits, or investor introductions. Program details may change
            before the cohort opens — see{" "}
            <Link href="/program" className="font-semibold text-emerald underline underline-offset-4">
              the full program page
            </Link>{" "}
            for exactly what is confirmed and what is conditional.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionEyebrow>How it works</SectionEyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
          Six pieces of work. One honest decision.
        </h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-2">
          {PARTICIPANT_WORK.map((item, i) => (
            <li
              key={item.title}
              className="rounded-lg border border-line bg-paper p-7"
            >
              <span className="font-display text-xl font-bold text-emerald">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-xl font-bold text-forest">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/85">
                {item.copy}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Link
            href="/program"
            className="inline-block rounded-full border border-forest px-7 py-3.5 font-semibold text-forest transition-colors hover:bg-forest hover:text-paper"
          >
            Read the Full Program Details
          </Link>
        </div>
      </section>

      {/* Who it is for */}
      <section className="bg-forest py-20 text-cream md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Who it is for
              </h2>
              <p className="mt-5 leading-relaxed text-cream/90">
                The pilot is designed for university seniors, recent graduates,
                early-career professionals, and other serious early-stage
                builders in Greater Seattle. Applicants may be technical or
                nontechnical, solo or part of a team — but they must show
                evidence of action and the capacity to meet the cohort
                commitment.
              </p>
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Evidence of action
              </h2>
              <p className="mt-5 leading-relaxed text-cream/90">
                Ideas and enthusiasm alone are not enough. Strong applications
                include a relevant artifact: a prototype, customer interviews,
                early usage, a service delivered manually, preorders, letters
                of intent, a technical experiment, or another credible sign
                that the applicant has begun learning through action.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community roles */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionEyebrow>Beyond founders</SectionEyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
          The community makes the program work.
        </h2>
        <p className="mt-5 max-w-2xl leading-relaxed text-ink/85">
          Every cohort needs three things from Greater Seattle: experienced
          people willing to hold office hours, organizations willing to be
          honest first customers or pilot partners, and sponsors who fund
          specific, measurable program needs.
        </p>
        <div className="mt-10">
          <Link
            href="/get-involved"
            className="inline-block rounded-full bg-forest px-7 py-3.5 font-semibold text-paper transition-colors hover:bg-emerald"
          >
            See How to Contribute
          </Link>
        </div>
      </section>

      {/* Interest form */}
      <section id="interest" className="scroll-mt-24 bg-cream/70 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold text-forest md:text-4xl">
                {siteConfig.combinatorApplicationsOpen
                  ? "Applications are open."
                  : "Be first in line for the pilot cohort."}
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-ink/85">
                Tell us the problem you are working on and where you are today.
                We will send program updates — including the cohort timeline
                and application details — as they are confirmed.
              </p>
              <div className="mt-8 max-w-xl">
                <EthicsNotice>
                  Your information is used only to share program news and
                  understand demand. No spam. Nothing is published without your
                  separate, explicit consent.
                </EthicsNotice>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-paper p-7 md:p-9">
              <CombinatorInterestForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
