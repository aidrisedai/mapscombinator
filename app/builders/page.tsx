import type { Metadata } from "next";
import { siteConfig } from "@/content/site";
import { ventures } from "@/content/ventures";
import { VentureCard } from "@/components/VentureCard";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { EmptyState } from "@/components/EmptyState";
import { EthicsNotice } from "@/components/EthicsNotice";

export const metadata: Metadata = {
  title: "Built Here | MAPS Builder Community",
  description:
    "Discover verified ventures, projects, and real problems being tackled by builders in the MAPS community.",
};

export default function BuildersPage() {
  const published = ventures.filter((v) => v.permissionToPublish);
  // Launch rule: the public directory needs the flag on AND two+ verified
  // profiles. Otherwise this route invites private submissions instead.
  const directoryLive = siteConfig.builderDirectoryEnabled && published.length >= 2;

  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <SectionEyebrow>Built Here</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-forest md:text-5xl">
            What the community is building.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Discover ventures, working projects, and real problems being
            tackled by members of the MAPS builder community. See the evidence,
            understand the next challenge, and find a useful way to help.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        {directoryLive ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {published.map((venture) => (
                <VentureCard key={venture.id} venture={venture} />
              ))}
            </div>
            <div className="mt-10 max-w-2xl">
              <EthicsNotice>
                Ventures listed here are independently operated unless
                otherwise stated. A listing does not imply MAPS endorsement,
                investment, ownership, or due diligence.
              </EthicsNotice>
            </div>
          </>
        ) : (
          <EmptyState
            message="The public directory opens once the first verified builder profiles are ready. Building something now? Tell us privately through the founding community form and we will follow up about a profile — nothing is published without your explicit consent."
            ctaLabel="Share What You Are Building"
            ctaHref="/get-involved#join"
          />
        )}
      </section>
    </>
  );
}
