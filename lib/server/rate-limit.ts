import "server-only";
import { sql } from "./db";
import { AppError } from "./errors";

/** Fixed-window counter in Postgres; shared across app instances. */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const [row] = await sql()`
    insert into rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  if (Math.random() < 0.01) {
    await sql()`delete from rate_limits where window_start < now() - interval '1 day'`;
  }
  if ((row.count as number) > limit) {
    throw new AppError("rate_limited", "Too many attempts. Please wait a few minutes and try again.");
  }
}
