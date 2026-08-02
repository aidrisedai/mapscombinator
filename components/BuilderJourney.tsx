import { journeySteps } from "@/content/pillars";

/** Compact vertical journey on mobile; restrained horizontal journey on
 * desktop. */
export function BuilderJourney() {
  return (
    <ol className="grid gap-6 md:grid-cols-4 lg:grid-cols-7 md:gap-4">
      {journeySteps.map((step, i) => (
        <li key={step.title} className="relative flex gap-4 md:block">
          <div className="flex flex-col items-center md:mb-3 md:flex-row md:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald font-display text-sm font-bold text-emerald">
              {i + 1}
            </span>
            <span
              aria-hidden="true"
              className="mt-1 w-px flex-1 bg-line md:mt-0 md:h-px md:w-full"
            />
          </div>
          <div className="pb-2">
            <h3 className="font-semibold text-forest">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
              {step.copy}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
