import "server-only";
import { listWeeks } from "@/lib/server/domain/cohorts";
import { sessionHostOptions } from "@/lib/server/domain/office-hours";
import type { Account } from "@/lib/server/session";
import { formatShortDate } from "@/lib/time";
import type { HostOption, WeekOption } from "./SessionFields";

/** Host and week choices for session forms (admin-checked by sessionHostOptions). */
export async function sessionFormOptions(account: Account, cohortId: string) {
  const [hostRows, weekRows] = await Promise.all([sessionHostOptions(account, cohortId), listWeeks(cohortId)]);
  const hosts: HostOption[] = hostRows.map((h) => ({ id: h.id as string, name: h.display_name as string, roles: (h.roles as string[]).map((r) => (r === "admin" ? "admin" : "mentor")) }));
  const weeks: WeekOption[] = weekRows.map((w) => ({ number: w.number as number, label: `Week ${w.number} (${formatShortDate(w.start_date)} – ${formatShortDate(w.end_date)})` }));
  const weekNumberById = new Map(weekRows.map((w) => [w.id as string, w.number as number]));
  return { hosts, weeks, weekNumberById };
}
