/** Verified proof, visually distinguished with the recurring "Evidence" label. */
export function EvidenceList({
  items,
  verifiedAt,
}: {
  items: string[];
  verifiedAt?: string;
}) {
  return (
    <div className="mt-4 rounded-md border border-emerald/30 bg-cream/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald">
        Evidence
        {verifiedAt && (
          <span className="ml-2 font-normal normal-case tracking-normal text-ink/60">
            verified {verifiedAt}
          </span>
        )}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/85">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
