import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Server-safe presentational primitives for the platform. */

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-forest text-paper hover:bg-emerald disabled:bg-forest/50",
  secondary: "border border-line bg-paper text-ink hover:border-forest hover:text-forest disabled:opacity-50",
  danger: "border border-error/40 bg-paper text-error hover:bg-error hover:text-paper disabled:opacity-50",
  ghost: "text-forest hover:bg-cream disabled:opacity-50",
};
export const buttonClass = (v: Variant = "primary", size: "md" | "sm" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed",
    size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
    variants[v],
  );

export function LinkButton({ href, variant = "primary", size = "md", children, className, ...rest }: { href: string; variant?: Variant; size?: "md" | "sm"; children: ReactNode; className?: string } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)} {...rest}>
      {children}
    </Link>
  );
}

export function PageHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold text-forest sm:text-3xl">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-sm text-ink/70">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return <As className={cx("rounded-lg border border-line/80 bg-paper p-5 shadow-[0_1px_0_rgba(16,21,18,0.03)]", className)}>{children}</As>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-cream text-ink/80 border-line",
  draft: "bg-sand/30 text-ink border-sand",
  published: "bg-emerald/10 text-success border-emerald/30",
  warn: "bg-[#fff4e5] text-[#7a4b00] border-[#f0c987]",
  danger: "bg-error/10 text-error border-error/30",
  info: "bg-forest/5 text-forest border-forest/20",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide", badgeTones[tone])}>{children}</span>;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "error" | "success"; title?: string; children?: ReactNode }) {
  const styles = {
    info: "border-forest/20 bg-forest/5 text-ink",
    warn: "border-[#f0c987] bg-[#fff8ec] text-ink",
    error: "border-error/40 bg-error/5 text-ink",
    success: "border-emerald/40 bg-emerald/5 text-ink",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-md border px-4 py-3 text-sm", styles)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(title && "mt-1", "text-ink/80")}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-cream/40 px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink/70">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {items.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-ink/60">{k}</dt>
          <dd className="text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Render user text safely: React escapes; we only preserve line breaks and simple bullets. */
export function Prose({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={cx("space-y-3 text-sm leading-relaxed text-ink/90", className)}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => <li key={j}>{l.replace(/^\s*[-*•]\s+/, "")}</li>)}
            </ul>
          );
        return (
          <p key={i} className="whitespace-pre-line break-words">
            {b}
          </p>
        );
      })}
    </div>
  );
}

/** External link (https only, validated server-side). */
export function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-emerald underline underline-offset-2 hover:text-forest">
      {children ?? href}
    </a>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <nav aria-label="Sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === current ? "page" : undefined}
          className={cx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            i.key === current ? "border-forest text-forest" : "border-transparent text-ink/60 hover:text-forest",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ page, hasMore, hrefFor }: { page: number; hasMore: boolean; hrefFor: (p: number) => string }) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
      {page > 1 ? <Link className="font-medium text-emerald hover:text-forest" href={hrefFor(page - 1)}>← Newer</Link> : <span />}
      <span className="text-ink/50">Page {page}</span>
      {hasMore ? <Link className="font-medium text-emerald hover:text-forest" href={hrefFor(page + 1)}>Older →</Link> : <span />}
    </nav>
  );
}
