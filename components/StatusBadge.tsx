import type { ProgramStatus } from "@/content/types";

const STATUS_STYLES: Record<ProgramStatus, string> = {
  Open: "bg-emerald text-paper",
  Waitlist: "bg-sand text-ink",
  Pilot: "bg-forest text-paper",
  "Interest List": "bg-cream text-forest border border-forest/40",
  Planned: "bg-cream text-ink border border-line",
  "Coming Later": "bg-paper text-ink/70 border border-line",
  Completed: "bg-line/40 text-ink/70",
};

/** Status is always conveyed with text, never color alone. */
export function StatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
