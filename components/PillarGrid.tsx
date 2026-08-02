import { pillars } from "@/content/pillars";

/** Five numbered pillars — editorial two-column layout on desktop,
 * full-width cards on mobile. */
export function PillarGrid() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
      {pillars.map((pillar, i) => (
        <li
          key={pillar.number}
          className={`bg-paper p-7 md:p-9 ${
            i === pillars.length - 1 ? "md:col-span-2 md:bg-cream" : ""
          }`}
        >
          <div className="flex items-baseline gap-4">
            <span
              aria-hidden="true"
              className="font-display text-2xl font-bold text-emerald"
            >
              {pillar.number}
            </span>
            <h3 className="font-display text-2xl font-bold text-forest">
              {pillar.name}
            </h3>
          </div>
          <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-ink/60">
            {pillar.purpose}
          </p>
          <p className="mt-4 max-w-prose leading-relaxed text-ink/85">
            {pillar.copy}
          </p>
        </li>
      ))}
    </ol>
  );
}
