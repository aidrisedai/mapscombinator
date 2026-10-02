import { DateTime, IANAZone } from "luxon";

/**
 * Time rules (PRD §5, §10): instants are stored in UTC; program dates are
 * local calendar dates in the cohort timezone; weeks are seven local dates.
 */

export function isValidTimezone(tz: string) {
  return IANAZone.isValidZone(tz);
}

export function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && DateTime.fromISO(s, { zone: "UTC" }).isValid;
}

export function isLocalTime(s: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Today's calendar date in a timezone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return DateTime.fromJSDate(now).setZone(tz).toISODate()!;
}

export function addDays(isoDate: string, days: number): string {
  return DateTime.fromISO(isoDate, { zone: "UTC" }).plus({ days }).toISODate()!;
}

export function diffDays(a: string, b: string): number {
  return Math.round(
    DateTime.fromISO(a, { zone: "UTC" }).diff(DateTime.fromISO(b, { zone: "UTC" }), "days").days,
  );
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a calendar date. */
export function weekdayOf(isoDate: string): number {
  return DateTime.fromISO(isoDate, { zone: "UTC" }).weekday;
}

export type WeekRange = { number: number; startDate: string; endDate: string };

export function programWeeks(startDate: string, weekCount: number): WeekRange[] {
  return Array.from({ length: weekCount }, (_, i) => ({
    number: i + 1,
    startDate: addDays(startDate, i * 7),
    endDate: addDays(startDate, i * 7 + 6),
  }));
}

/** Program week number for a local date, or null if outside the program. */
export function weekNumberFor(startDate: string, weekCount: number, isoDate: string): number | null {
  const d = diffDays(isoDate, startDate);
  if (d < 0) return null;
  const n = Math.floor(d / 7) + 1;
  return n > weekCount ? null : n;
}

export type LocalResolution =
  | { kind: "ok"; utc: Date }
  | { kind: "ambiguous"; earlier: Date; later: Date }
  | { kind: "nonexistent" };

/**
 * Resolve a local wall-clock date/time in a zone to UTC, detecting DST gaps
 * (nonexistent) and overlaps (ambiguous) instead of silently shifting.
 */
export function resolveLocal(isoDate: string, hhmm: string, tz: string): LocalResolution {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  const zone = IANAZone.create(tz);
  const candidates = new Set<number>();
  // Offsets around the instant cover any DST transition (max 3h shifts).
  for (const probeHours of [-26, -3, -1, 0, 1, 3, 26]) {
    const offset = zone.offset(naiveUtc + probeHours * 3_600_000); // minutes
    const utc = naiveUtc - offset * 60_000;
    const back = DateTime.fromMillis(utc, { zone: tz });
    if (back.year === y && back.month === mo && back.day === d && back.hour === h && back.minute === mi) {
      candidates.add(utc);
    }
  }
  const list = [...candidates].sort((a, b) => a - b);
  if (list.length === 0) return { kind: "nonexistent" };
  if (list.length === 1) return { kind: "ok", utc: new Date(list[0]) };
  return { kind: "ambiguous", earlier: new Date(list[0]), later: new Date(list[list.length - 1]) };
}

/** Resolve, choosing an offset for ambiguous times; null when nonexistent. */
export function localToUtc(
  isoDate: string,
  hhmm: string,
  tz: string,
  ambiguous: "earlier" | "later" | "reject" = "reject",
): Date | null {
  const r = resolveLocal(isoDate, hhmm, tz);
  if (r.kind === "ok") return r.utc;
  if (r.kind === "nonexistent") return null;
  if (ambiguous === "reject") return null;
  return ambiguous === "earlier" ? r.earlier : r.later;
}

export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hhmmOf(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// ───────────────────────────── Display ─────────────────────────────────────

/** "Tue, Oct 14, 2026, 5:00 PM PDT" — always absolute date + zone. */
export function formatInstant(at: Date | string, tz: string) {
  const dt = DateTime.fromJSDate(new Date(at)).setZone(tz);
  return dt.toFormat("ccc, LLL d, yyyy, h:mm a ZZZZ");
}

export function formatTimeRange(start: Date | string, end: Date | string, tz: string) {
  const s = DateTime.fromJSDate(new Date(start)).setZone(tz);
  const e = DateTime.fromJSDate(new Date(end)).setZone(tz);
  return `${s.toFormat("ccc, LLL d, yyyy, h:mm a")} – ${e.toFormat("h:mm a ZZZZ")}`;
}

export function formatDate(isoDate: string) {
  return DateTime.fromISO(isoDate, { zone: "UTC" }).toFormat("ccc, LLL d, yyyy");
}

export function formatShortDate(isoDate: string) {
  return DateTime.fromISO(isoDate, { zone: "UTC" }).toFormat("LLL d");
}

export function zoneAbbrev(tz: string, at: Date = new Date()) {
  return DateTime.fromJSDate(at).setZone(tz).toFormat("ZZZZ");
}

/** Local date (in tz) of an instant. */
export function localDateOf(at: Date | string, tz: string) {
  return DateTime.fromJSDate(new Date(at)).setZone(tz).toISODate()!;
}

export function localTimeOf(at: Date | string, tz: string) {
  return DateTime.fromJSDate(new Date(at)).setZone(tz).toFormat("HH:mm");
}

/** Postgres returns `date` columns as JS Dates at UTC midnight (or strings). */
export function isoDateOf(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return DateTime.fromJSDate(value, { zone: "UTC" }).toISODate()!;
}
