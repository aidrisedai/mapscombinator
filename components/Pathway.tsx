const STEPS = ["Meet", "Learn", "Validate", "Build", "Launch", "Return"];

/** The repeatable pathway, rendered as a concise visual. */
export function Pathway({ tone = "light" }: { tone?: "light" | "dark" }) {
  const text = tone === "dark" ? "text-cream" : "text-forest";
  const arrow = tone === "dark" ? "text-moss" : "text-line";
  return (
    <p
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 font-medium uppercase tracking-[0.15em] text-sm ${text}`}
    >
      {STEPS.map((step, i) => (
        <span key={step} className="flex items-center gap-x-3">
          <span>{step}</span>
          {i < STEPS.length - 1 && (
            <span aria-hidden="true" className={arrow}>
              →
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
