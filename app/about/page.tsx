import type { Metadata } from "next";
import { stageCopy } from "@/content/site";
import { SectionEyebrow } from "@/components/SectionEyebrow";

export const metadata: Metadata = {
  title: "About",
  description:
    "The MAPS Center for Entrepreneurship & Innovation is being developed as a year-round home for Muslim builders in Greater Seattle.",
};

const BELIEFS = [
  {
    title: "Ambition needs a moral direction",
    copy: "Building profitable and enduring organizations can serve the public good. The question is not whether ambition is good or bad; it is what the ambition serves, who benefits, who bears the risk, and what kind of future it creates.",
  },
  {
    title: "Evidence is a form of respect",
    copy: "Builders should understand the people affected by a problem before prescribing a solution. We prioritize direct conversations, observation, experiments, working artifacts, and honest learning.",
  },
  {
    title: "Community should produce capability",
    copy: "Belonging matters, but a builder community should also make its members more useful, more courageous, more disciplined, and better able to help others.",
  },
  {
    title: "Success carries responsibility",
    copy: "Knowledge, access, wealth, and influence become more meaningful when they expand opportunity and strengthen the institutions that serve people.",
  },
];

const IS_IS_NOT: [string, string][] = [
  ["A year-round builder community", "Only a networking group"],
  [
    "A place for practical learning and accountable work",
    "A calendar of motivational talks",
  ],
  [
    "A pathway from problem discovery to tested venture",
    "A pitch competition factory",
  ],
  [
    "Ethically and spiritually grounded",
    "A label placed on ordinary startup culture",
  ],
  [
    "Connected to external partners and next-stage opportunities",
    "A guarantee of funding or commercial success",
  ],
  [
    "Designed to strengthen the wider community",
    "An exclusive club that exists for status",
  ],
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <SectionEyebrow>About the MAPS Center</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-forest md:text-5xl">
            Build what matters. Build it well. Build it together.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            The MAPS Center for Entrepreneurship &amp; Innovation{" "}
            {stageCopy.aboutIntroVerb} a year-round home for Muslim builders in
            Greater Seattle. It brings together the community, practical
            learning, disciplined venture-building, ethical reflection, and
            pathways to contribute back.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="font-display text-3xl font-bold text-forest">
          Our mission
        </h2>
        <blockquote className="mt-5 max-w-2xl border-l-4 border-emerald pl-6 text-xl leading-relaxed text-ink/90">
          We help spiritually grounded builders develop the skills,
          relationships, and disciplined execution needed to turn meaningful
          problems into useful ventures and institutions.
        </blockquote>
      </section>

      <section className="bg-cream/60 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-bold text-forest">
            What we believe
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {BELIEFS.map((belief) => (
              <div key={belief.title} className="border-t border-line pt-5">
                <h3 className="font-display text-xl font-bold text-forest">
                  {belief.title}
                </h3>
                <p className="mt-3 leading-relaxed text-ink/85">{belief.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="font-display text-3xl font-bold text-forest">
          Who this is for
        </h2>
        <div className="mt-5 max-w-2xl space-y-5 leading-relaxed text-ink/85">
          <p>
            The center is designed first for active Muslim builders and
            early-stage founders in Greater Seattle: founders, engineers,
            product leaders, researchers, designers, creatives, operators,
            students, and professionals prepared to contribute to real work.
          </p>
          <p>
            Programs may welcome participants and collaborators of other
            backgrounds who respect the center&rsquo;s Islamic ethical
            grounding and community standards.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 md:pb-20">
        <h2 className="font-display text-3xl font-bold text-forest">
          What the center is—and is not
        </h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b-2 border-forest pb-3 pr-6 font-display text-lg text-forest"
                >
                  The center is
                </th>
                <th
                  scope="col"
                  className="border-b-2 border-forest pb-3 font-display text-lg text-forest"
                >
                  The center is not
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
      </section>

      <section className="bg-forest py-16 text-cream md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-bold">
            Governance and transparency
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-cream/90">
            The center is currently being developed with MAPS stakeholders and
            members of Greater Seattle&rsquo;s technology, entrepreneurial, and
            community ecosystem. Governance, program ownership, facility
            access, budgets, safety, and reporting will be finalized before
            programs are represented as operational.
          </p>
        </div>
      </section>
    </>
  );
}
