import type { Venture } from "@/content/types";
import { EvidenceList } from "./EvidenceList";

export function VentureCard({ venture }: { venture: Venture }) {
  if (!venture.permissionToPublish) return null;
  return (
    <article className="flex flex-col rounded-lg border border-line bg-paper p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald">
          {venture.domain}
        </p>
        <span className="rounded-full border border-line px-3 py-1 text-xs font-medium uppercase tracking-wider text-ink/70">
          {venture.stage}
        </span>
      </div>
      <h3 className="mt-3 font-display text-2xl font-bold text-forest">
        {venture.name}
      </h3>
      <p className="mt-1 text-sm text-ink/70">
        {venture.founders.map((f) => f.name).join(", ")}
      </p>
      <p className="mt-3 leading-relaxed text-ink/85">{venture.oneLineProblem}</p>
      {venture.evidence && venture.evidence.length > 0 && (
        <EvidenceList items={venture.evidence} verifiedAt={venture.verifiedAt} />
      )}
      {venture.currentNeed && (
        <p className="mt-4 text-sm">
          <span className="font-semibold text-forest">Current need: </span>
          {venture.currentNeed}
        </p>
      )}
      {venture.websiteUrl && (
        <a
          href={venture.websiteUrl}
          className="mt-5 self-start text-sm font-semibold text-emerald underline underline-offset-4 hover:text-forest"
          rel="noopener noreferrer"
        >
          Visit site
        </a>
      )}
    </article>
  );
}
