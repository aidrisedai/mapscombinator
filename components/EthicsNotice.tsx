/** Reusable disclaimer/clarification block with restrained styling. */
export function EthicsNotice({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="rounded-md border-l-4 border-emerald bg-cream/70 p-5">
      {title && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest">
          {title}
        </p>
      )}
      <div className="text-sm leading-relaxed text-ink/85">{children}</div>
    </aside>
  );
}
