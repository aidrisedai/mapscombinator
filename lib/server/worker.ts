import "server-only";
import { processOutbox } from "./email/outbox";
import { refreshAllSlots } from "./domain/mentors";
import { cleanupOrphanUploads } from "./domain/weeks";

/**
 * Background loop: drains the email outbox every few seconds, extends
 * availability slots hourly, and cleans orphaned uploads daily. Multiple
 * instances are safe (SKIP LOCKED / advisory locks / idempotent writes).
 */
export function startWorker(log = (o: Record<string, unknown>) => console.log(JSON.stringify(o))) {
  const g = globalThis as unknown as { __mapsWorker?: boolean };
  if (g.__mapsWorker) return;
  g.__mapsWorker = true;
  let lastHourly = 0;
  let lastDaily = 0;
  const tick = async () => {
    try {
      let n: number;
      do {
        n = await processOutbox(25);
        if (n) log({ level: "info", msg: "outbox processed", count: n });
      } while (n === 25);
      if (Date.now() - lastHourly > 3600_000) {
        lastHourly = Date.now();
        const created = await refreshAllSlots();
        if (created) log({ level: "info", msg: "slots refreshed", created });
      }
      if (Date.now() - lastDaily > 86400_000) {
        lastDaily = Date.now();
        const cleaned = await cleanupOrphanUploads();
        if (cleaned) log({ level: "info", msg: "orphan uploads cleaned", count: cleaned });
      }
    } catch (err) {
      log({ level: "error", msg: "worker tick failed", err: (err as Error).message });
    } finally {
      setTimeout(tick, 5000);
    }
  };
  setTimeout(tick, 2000);
  log({ level: "info", msg: "worker started" });
}
