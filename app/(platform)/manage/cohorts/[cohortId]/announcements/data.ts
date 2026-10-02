import "server-only";
import { listWeeks } from "@/lib/server/domain/cohorts";
import { listSessions } from "@/lib/server/domain/office-hours";
import type { Account } from "@/lib/server/session";
import { formatDate, formatInstant, formatShortDate, localDateOf } from "@/lib/time";

/** Week and session choices for the announcement form. */
export async function announcementFormOptions(account: Account, cohortId: string) {
  const [up, past, weekRows] = await Promise.all([
    listSessions(account, cohortId, { when: "upcoming", limit: 100 }),
    listSessions(account, cohortId, { when: "past", limit: 30 }),
    listWeeks(cohortId),
  ]);
  const sessions = [...up.sessions, ...past.sessions].map((s) => ({
    id: s.id as string,
    label: `${s.title} — ${formatInstant(s.starts_at, s.timezone)}${s.state === "draft" ? " (draft)" : s.state === "cancelled" ? " (cancelled)" : ""}`,
  }));
  const weeks = weekRows.map((w) => ({ number: w.number as number, label: `Week ${w.number} (${formatShortDate(w.start_date)} – ${formatShortDate(w.end_date)})` }));
  return { sessions, weeks };
}

/** Stored expiry is the end of a local day; show that day. */
export function expiryIsoDate(expiresAt: Date | string, tz: string) {
  return localDateOf(new Date(new Date(expiresAt).getTime() - 1000), tz);
}
export function expiryDate(expiresAt: Date | string, tz: string) {
  return formatDate(expiryIsoDate(expiresAt, tz));
}
