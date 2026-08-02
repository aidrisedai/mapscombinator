import Link from "next/link";

/** Honest, useful empty state — never a dead calendar or broken shell. */
export function EmptyState({
  message,
  ctaLabel,
  ctaHref,
}: {
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-cream/50 p-10 text-center">
      <p className="mx-auto max-w-xl leading-relaxed text-ink/80">{message}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-paper hover:bg-emerald"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
