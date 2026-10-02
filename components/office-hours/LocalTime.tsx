"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
const viewerZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The viewer's IANA timezone, or null during server render / before hydration. */
export function useViewerTimezone(): string | null {
  return useSyncExternalStore(noop, viewerZone, () => null);
}

const DATE_TIME: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
const TIME_ZONE: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };

function fmt(d: Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(d);
}

/**
 * Shows the viewer-local equivalent of an instant (or range) — only when it
 * differs from the zone it's scheduled in. Renders nothing on the server.
 */
export function LocalTime({ start, end, zone, prefix = "Your time:" }: { start: string | Date; end?: string | Date | null; zone: string; prefix?: string }) {
  const viewer = useViewerTimezone();
  if (!viewer || viewer === zone) return null;
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const same = fmt(s, viewer, DATE_TIME) === fmt(s, zone, DATE_TIME) && (!e || fmt(e, viewer, DATE_TIME) === fmt(e, zone, DATE_TIME));
  if (same) return null;
  const endSameDay = e && fmt(e, viewer, { year: "numeric", month: "numeric", day: "numeric" }) === fmt(s, viewer, { year: "numeric", month: "numeric", day: "numeric" });
  const text = e
    ? `${fmt(s, viewer, DATE_TIME)} – ${endSameDay ? fmt(e, viewer, TIME_ZONE) : fmt(e, viewer, { ...DATE_TIME, timeZoneName: "short" })}`
    : fmt(s, viewer, { ...DATE_TIME, timeZoneName: "short" });
  return (
    <span className="block text-xs text-ink/60">
      {prefix} {text}
    </span>
  );
}
