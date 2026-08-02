import Link from "next/link";
import { siteConfig, stageCopy } from "@/content/site";
import { events } from "@/content/events";
import { ventures } from "@/content/ventures";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { PillarGrid } from "@/components/PillarGrid";
import { Pathway } from "@/components/Pathway";
import { SoundContour } from "@/components/SoundContour";
import { EventCard } from "@/components/EventCard";
import { VentureCard } from "@/components/VentureCard";
import { EthicsNotice } from "@/components/EthicsNotice";
import { InterestForm } from "@/components/InterestForm";

export default function HomePage() {
  const upcomingEvents = siteConfig.eventsEnabled
    ? events
        .filter((e) => e.status === "Open" || e.status === "Waitlist")
        .filter((e) => e.verification.verified)
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .slice(0, 3)
    : [];
  const publishedVentures = siteConfig.builderDirectoryEnabled
    ? ventures.filter((v) => v.permissionToPublish)
    : [];

  return (
    <>
      {/* 1 — Hero */}
      <section className="relative overflow-hidden bg-cream">
        <SoundContour className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full text-emerald/60" />
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-16 md:pb-32 md:pt-24">
          <SectionEyebrow>{stageCopy.heroEyebrow}</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-forest md:text-6xl">
            A home for Muslim builders in Greater Seattle.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Build useful ventures. Find your people. Strengthen the community.
            The MAPS Center brings together founders, technologists, creatives,
            mentors, and institutions to move from meaningful problems to
            real-world value.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href={stageCopy.primaryCta.href}
              className="rounded-full bg-forest px-7 py-3.5 font-semibold text-paper transition-colors hover:bg-emerald"
            >
              {stageCopy.primaryCta.label}
            </Link>
            <Link
              href={stageCopy.secondaryCta.href}
              className="rounded-full border border-forest px-7 py-3.5 font-semibold text-forest transition-colors hover:bg-forest hover:text-paper"
            >
              {stageCopy.secondaryCta.label}
            </Link>
          </div>
          <p className="mt-5 text-sm text-ink/60">
            Rooted in Islamic ethics. Open to collaborators who respect the
            standard.
          </p>

          <div className="mt-14 max-w-md rounded-lg border border-forest/20 bg-paper/80 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald">
              The founding question
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-forest">
              What are you building?
            </p>
          </div>
        </div>
      </section>

      {/* 2 — The missing infrastructure */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionEyebrow>Why this center</SectionEyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
          The talent is here. The pathway is fragmented.
        </h2>
        <div className="mt-6 max-w-2xl space-y-5 leading-relaxed text-ink/85">
          <p>
            Greater Seattle is filled with Muslim engineers, founders,
            creatives, researchers, operators, students, and community leaders.
            But too often they meet only in fragments—an event here, a group
            chat there, a mentor introduction when luck allows. Ideas receive
            inspiration and then lose momentum.
          </p>
          <p>
            We are building the connective infrastructure: a consistent place
            to meet, learn, validate, build, launch, and return value to the
            community.
          </p>
        </div>
        <div className="mt-10 border-y border-line py-6">
          <Pathway />
        </div>
      </section>

      {/* 3 — Five pillars */}
      <section id="how-it-works" className="scroll-mt-24 bg-cream/60 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <SectionEyebrow>One center. Five ways forward.</SectionEyebrow>
          <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
            Come for the community. Stay for the work.
          </h2>
          <div className="mt-10">
            <PillarGrid />
          </div>
          <div className="mt-10">
            <Link
              href="/programs"
              className="inline-block rounded-full bg-forest px-7 py-3.5 font-semibold text-paper transition-colors hover:bg-emerald"
            >
              Explore Programs
            </Link>
          </div>
        </div>
      </section>

      {/* 4 — Upcoming events */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionEyebrow>The front door</SectionEyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
          Come build in the same room.
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink/85">
          Founder gatherings, workshops, coworking sessions, and demo nights
          are where the community becomes real.
        </p>
        {upcomingEvents.length > 0 ? (
          <>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
            <div className="mt-8">
              <Link
                href="/events"
                className="font-semibold text-emerald underline underline-offset-4 hover:text-forest"
              >
                View All Events
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-10 rounded-lg border border-dashed border-line bg-cream/50 p-10">
            <p className="max-w-xl leading-relaxed text-ink/80">
              The first events are being prepared. Join the founding community
              and we will send you the launch schedule when it is confirmed.
            </p>
            <Link
              href="/get-involved#join"
              className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-paper hover:bg-emerald"
            >
              Join the Founding Community
            </Link>
          </div>
        )}
      </section>

      {/* 5 — MAPS Combinator feature */}
      <section className="bg-forest py-20 text-cream md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <p className="inline-block rounded-full border border-moss/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            Pilot program · {siteConfig.combinatorStatus}
          </p>
          <h2 className="mt-6 max-w-2xl font-display text-3xl font-bold md:text-4xl">
            Twelve weeks for builders ready to replace assumptions with
            evidence.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-cream/90">
            MAPS Combinator is a selective, equity-free early-stage incubator
            for teams prepared to do serious work. Participants investigate a
            meaningful problem, speak with real users, build and test a useful
            product, develop an operating foundation, and leave with a clear
            next-stage decision.
          </p>
          <dl className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                term: "Equity-free",
                def: "MAPS does not take ownership in participating ventures.",
              },
              {
                term: "Evidence-driven",
                def: "User behavior, experiments, and working artifacts matter more than pitch polish.",
              },
              {
                term: "Ethically grounded",
                def: "Teams consider benefit, harm, responsibility, and long-term consequences as part of venture quality.",
              },
            ].map(({ term, def }) => (
              <div key={term} className="border-t border-moss/40 pt-4">
                <dt className="font-display text-lg font-bold">{term}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-cream/85">
                  {def}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 max-w-2xl border-l-2 border-moss/50 pl-4 text-sm leading-relaxed text-cream/80">
            The Combinator is an early-stage incubator, not an investment fund
            or accelerator. Participation does not guarantee funding,
            customers, incorporation, credits, or investor introductions.
          </p>
          <div className="mt-9">
            <Link
              href="/programs/combinator"
              className="inline-block rounded-full bg-cream px-7 py-3.5 font-semibold text-forest transition-colors hover:bg-paper"
            >
              {siteConfig.combinatorApplicationsOpen
                ? "Review the Program and Apply"
                : "Join the Combinator Interest List"}
            </Link>
          </div>
        </div>
      </section>

      {/* 6 — Built Here (hidden until two verified profiles exist) */}
      {publishedVentures.length >= 2 && (
        <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <SectionEyebrow>From the community</SectionEyebrow>
          <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
            See what people are building—and where you can help.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink/85">
            Useful ecosystems make work visible. Discover the problems members
            are tackling, the evidence they have gathered, and the customers,
            collaborators, mentors, or expertise they need next.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {publishedVentures.slice(0, 4).map((venture) => (
              <VentureCard key={venture.id} venture={venture} />
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/builders"
              className="font-semibold text-emerald underline underline-offset-4 hover:text-forest"
            >
              Explore What Is Being Built
            </Link>
          </div>
        </section>
      )}

      {/* 7 — Build–Grow–Return loop */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionEyebrow>The return loop</SectionEyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-bold text-forest md:text-4xl">
          Success should expand the community&rsquo;s capacity.
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink/85">
          The center helps builders gain community, skills, accountability,
          visibility, and appropriate connections. As ventures and careers
          grow, members return value through mentorship, internships, hiring,
          sponsorship, expertise, service, introductions, or charitable
          support. Each generation should make the path stronger for the next.
        </p>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              step: "Build",
              copy: "Receive structure, relationships, and practical support.",
            },
            {
              step: "Grow",
              copy: "Create useful products, sustainable ventures, jobs, and expertise.",
            },
            {
              step: "Return",
              copy: "Help new builders and strengthen community institutions.",
            },
          ].map(({ step, copy }, i) => (
            <li key={step} className="rounded-lg border border-line bg-paper p-7">
              <span className="font-display text-2xl font-bold text-emerald">
                {i + 1}
              </span>
              <h3 className="mt-2 font-display text-xl font-bold text-forest">
                {step}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{copy}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Link
            href="/get-involved"
            className="inline-block rounded-full border border-forest px-7 py-3.5 font-semibold text-forest transition-colors hover:bg-forest hover:text-paper"
          >
            Find a Way to Contribute
          </Link>
        </div>
      </section>

      {/* 8 — Founding community conversion */}
      <section id="join" className="scroll-mt-24 bg-cream/70 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold text-forest md:text-4xl">
                What are you building—or what should be built?
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-ink/85">
                Join the founding community if you are building now, ready to
                begin, able to mentor, looking to contribute, or interested in
                helping shape a serious Muslim builder ecosystem in Greater
                Seattle.
              </p>
              <div className="mt-8 max-w-xl">
                <EthicsNotice>
                  We will use your information only to understand the community
                  and share relevant updates. No spam. No public directory
                  listing without separate consent.
                </EthicsNotice>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-paper p-7 md:p-9">
              <InterestForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
