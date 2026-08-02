import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/content/site";
import { SectionEyebrow } from "@/components/SectionEyebrow";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact the MAPS Center for Entrepreneurship & Innovation in Greater Seattle.",
};

export default function ContactPage() {
  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <SectionEyebrow>Contact</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-forest md:text-5xl">
            Reach the team.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Questions about the center, programs, partnership, or press — send
            a note and we will route it to the right person.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-paper p-8">
            <h2 className="font-display text-xl font-bold text-forest">Email</h2>
            {siteConfig.contactEmail ? (
              <>
                <p className="mt-3 leading-relaxed text-ink/85">
                  The fastest way to reach us:
                </p>
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="mt-2 inline-block font-semibold text-emerald underline underline-offset-4 hover:text-forest"
                >
                  {siteConfig.contactEmail}
                </a>
              </>
            ) : (
              <p className="mt-3 leading-relaxed text-ink/85">
                A public contact address is being finalized. In the meantime,
                use the founding community form and we will follow up.
              </p>
            )}
            <p className="mt-6 text-sm text-ink/70">
              {siteConfig.locationLabel}
            </p>
          </div>

          <div className="rounded-lg border border-line bg-paper p-8">
            <h2 className="font-display text-xl font-bold text-forest">
              Looking to participate?
            </h2>
            <p className="mt-3 leading-relaxed text-ink/85">
              Builders, mentors, volunteers, partners, and sponsors each have a
              focused path on the Get Involved page — that form reaches us with
              the context we need to respond well.
            </p>
            <Link
              href="/get-involved"
              className="mt-5 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-paper hover:bg-emerald"
            >
              Get Involved
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
