import { DateTime } from "luxon";
import { formatDate, formatTimeRange, localDateOf } from "@/lib/time";

/** A bookable slot prepared for display, grouped by its local date in the slot's own timezone. */
export type SlotView = {
  id: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
  label: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  minutes: number;
  location: string | null;
  online: boolean;
};

export function toSlotView(s: { id: string; starts_at: Date | string; ends_at: Date | string; timezone: string; location?: string | null; meeting_url?: string | null }): SlotView {
  const start = new Date(s.starts_at);
  const end = new Date(s.ends_at);
  const dateKey = localDateOf(start, s.timezone);
  const st = DateTime.fromJSDate(start).setZone(s.timezone);
  const en = DateTime.fromJSDate(end).setZone(s.timezone);
  return {
    id: s.id,
    dateKey,
    dateLabel: `${formatDate(dateKey)} · ${s.timezone.replaceAll("_", " ")}`,
    timeLabel: `${st.toFormat("h:mm a")} – ${en.toFormat("h:mm a ZZZZ")}`,
    label: formatTimeRange(start, end, s.timezone),
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timezone: s.timezone,
    minutes: Math.round((end.getTime() - start.getTime()) / 60000),
    location: s.location ?? null,
    online: Boolean(s.meeting_url),
  };
}

export function groupSlots(slots: SlotView[]) {
  const m = new Map<string, { label: string; slots: SlotView[] }>();
  for (const s of slots) {
    const g = m.get(s.dateKey) ?? { label: s.dateLabel, slots: [] };
    g.slots.push(s);
    m.set(s.dateKey, g);
  }
  return [...m.entries()];
}
