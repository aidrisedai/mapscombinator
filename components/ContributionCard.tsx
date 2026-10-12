import Link from "next/link";

const ctaClass =
  "inline-block rounded-full border border-forest px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-paper";

export function ContributionCard({
  id,
  title,
  copy,
  ctaLabel,
  ctaHref,
}: {
  id?: string;
  title: string;
  copy: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <article
      id={id}
      className="flex flex-col rounded-lg border border-line bg-paper p-7 scroll-mt-28"
    >
      <h3 className="font-display text-xl font-bold text-forest">{title}</h3>
      <p className="mt-3 flex-1 leading-relaxed text-ink/85">{copy}</p>
      <div className="mt-5">
        {ctaHref.startsWith("#") ? (
          // A plain anchor fires "hashchange", which preselects the matching option in the form below.
          <a href={ctaHref} className={ctaClass}>
            {ctaLabel}
          </a>
        ) : (
          <Link href={ctaHref} className={ctaClass}>
            {ctaLabel}
          </Link>
        )}
      </div>
    </article>
  );
}
