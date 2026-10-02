import { formatInstant, formatTimeRange } from "@/lib/time";
import { cx } from "@/components/ui/primitives";
import { LocalTime } from "./LocalTime";

/** Absolute date, time and zone in the scheduled timezone, plus the viewer-local equivalent when it differs. */
export function When({ start, end, tz, className, strike }: { start: Date | string; end?: Date | string | null; tz: string; className?: string; strike?: boolean }) {
  return (
    <span className={cx("block", className)}>
      <span className={cx("block font-medium text-ink", strike && "line-through decoration-error/60")}>{end ? formatTimeRange(start, end, tz) : formatInstant(start, tz)}</span>
      <LocalTime start={start} end={end ?? null} zone={tz} />
    </span>
  );
}
