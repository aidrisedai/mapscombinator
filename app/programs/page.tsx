import type { Metadata } from "next";
import { programs } from "@/content/programs";
import { ProgramCard } from "@/components/ProgramCard";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { EthicsNotice } from "@/components/EthicsNotice";

export const metadata: Metadata = {
  title: "Programs",
  description:
    "Explore community gatherings, builder coworking, workshops, build weekends, Entrepreneurs in Residence, and MAPS Combinator.",
};

export default function ProgramsPage() {
  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <SectionEyebrow>Programs</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-forest md:text-5xl">
            Different doors. One builder journey.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Start with an open event, bring a problem to office hours, build
            alongside peers, or apply to a focused program when you are ready.
            Every offering should help a participant take a clearer next step.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="grid gap-6 lg:grid-cols-2">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
        <div className="mt-12 max-w-2xl">
          <EthicsNotice title="A note on statuses">
            Statuses reflect what is real today. Programs marked{" "}
            <strong>Interest List</strong>, <strong>Planned</strong>, or{" "}
            <strong>Coming Later</strong> are in development — joining an
            interest list is the best way to hear when they open. We do not
            promote equipment, benefits, or access that are not yet secured.
          </EthicsNotice>
        </div>
      </section>
    </>
  );
}
