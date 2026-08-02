import type { Metadata } from "next";
import { SectionEyebrow } from "@/components/SectionEyebrow";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for the MAPS Center website.",
};

/**
 * PLACEHOLDER FOR LEGAL REVIEW.
 * Safe baseline language, not reviewed terms. Replace after counsel review
 * before formal launch.
 */
export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <SectionEyebrow>Terms</SectionEyebrow>
      <h1 className="font-display text-4xl font-bold text-forest">
        Terms of use
      </h1>
      <div className="mt-8 space-y-6 leading-relaxed text-ink/85">
        <p>
          This website describes an initiative that is in a planning stage.
          Please read these points before relying on anything published here:
        </p>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            Program descriptions, statuses, and benefits reflect current
            planning and may change before any program formally opens.
          </li>
          <li>
            Nothing on this site is legal, tax, financial, or investment
            advice. Educational content and templates are provided for general
            information only.
          </li>
          <li>
            Participation in any future program does not guarantee funding,
            customers, company formation, credits, introductions, or any
            specific outcome.
          </li>
          <li>
            Ventures that may be described on this site are independently
            operated unless otherwise stated; a mention does not imply
            endorsement, investment, ownership, or due diligence.
          </li>
          <li>
            Content on this site may not be reproduced in a way that implies an
            affiliation or approval that has not been granted.
          </li>
        </ul>
        <p className="text-sm text-ink/60">
          Complete terms will be published following legal review before
          programs formally launch.
        </p>
      </div>
    </section>
  );
}
