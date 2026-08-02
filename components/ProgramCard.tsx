import Link from "next/link";
import type { Program } from "@/content/types";
import { StatusBadge } from "./StatusBadge";

export function ProgramCard({ program }: { program: Program }) {
  return (
    <article className="flex flex-col rounded-lg border border-line bg-paper p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald">
          {program.pillar}
        </p>
        <StatusBadge status={program.status} />
      </div>
      <h3 className="mt-3 font-display text-2xl font-bold text-forest">
        {program.name}
      </h3>
      <p className="mt-3 leading-relaxed text-ink/85">{program.purpose}</p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line/70 pt-5 text-sm">
        <div>
          <dt className="font-semibold uppercase tracking-wider text-ink/50 text-xs">
            Audience
          </dt>
          <dd className="mt-0.5 text-ink/85">{program.audience}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wider text-ink/50 text-xs">
            Format
          </dt>
          <dd className="mt-0.5 text-ink/85">{program.format}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wider text-ink/50 text-xs">
            Commitment
          </dt>
          <dd className="mt-0.5 text-ink/85">{program.timeCommitment}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wider text-ink/50 text-xs">
            Cost
          </dt>
          <dd className="mt-0.5 text-ink/85">{program.cost}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wider text-ink/50 text-xs">
            Location
          </dt>
          <dd className="mt-0.5 text-ink/85">{program.location}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wider text-ink/50 text-xs">
            Next date
          </dt>
          <dd className="mt-0.5 text-ink/85">{program.nextDate}</dd>
        </div>
      </dl>

      <div className="mt-6 pt-1">
        <Link
          href={program.cta.href}
          className="inline-block rounded-full border border-forest px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-paper"
        >
          {program.cta.label}
        </Link>
      </div>
    </article>
  );
}
