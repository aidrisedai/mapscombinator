import type { Metadata } from "next";
import { siteConfig } from "@/content/site";
import { SectionEyebrow } from "@/components/SectionEyebrow";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy practices for the MAPS Center website.",
};

/**
 * PLACEHOLDER FOR LEGAL REVIEW.
 * This is safe baseline language, not a reviewed policy. Before formal
 * launch, have qualified counsel review and replace this page, and document
 * the data retention and deletion process.
 */
export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <SectionEyebrow>Privacy</SectionEyebrow>
      <h1 className="font-display text-4xl font-bold text-forest">
        Privacy at the MAPS Center
      </h1>
      <div className="mt-8 space-y-6 leading-relaxed text-ink/85">
        <p>
          This website is at an early, planning stage. Our privacy commitments
          are simple:
        </p>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            We collect only the information you choose to share through our
            forms — such as your name, email, city, and what you tell us about
            your work or interests.
          </li>
          <li>
            We use that information solely to understand the founding
            community and to send relevant updates you have consented to
            receive.
          </li>
          <li>We do not sell your information.</li>
          <li>
            We never list anyone in a public directory without separate,
            explicit consent.
          </li>
          <li>
            We do not request sensitive personal information — such as details
            of religious practice, immigration status, or financial
            information — on our interest forms.
          </li>
          <li>
            To ask what information we hold about you, or to request its
            deletion, contact{" "}
            {siteConfig.contactEmail ? (
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-semibold text-emerald underline underline-offset-4"
              >
                {siteConfig.contactEmail}
              </a>
            ) : (
              "us through the contact page"
            )}
            .
          </li>
        </ul>
        <p className="text-sm text-ink/60">
          A complete privacy policy will be published following legal review
          before programs formally launch.
        </p>
      </div>
    </section>
  );
}
