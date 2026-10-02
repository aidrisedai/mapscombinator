import "server-only";
import postgres from "postgres";
import { env } from "./env";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;
/** Either the pool or an open transaction. */
export type Db = Sql | Tx;

const globalForDb = globalThis as unknown as { __mapsSql?: Sql };

export function sql(): Sql {
  if (!globalForDb.__mapsSql) {
    const e = env();
    globalForDb.__mapsSql = postgres(e.DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      ssl: e.DATABASE_SSL === "require" ? "require" : false,
      transform: { undefined: null },
      // Keep calendar dates as "YYYY-MM-DD" strings, never shifted Dates.
      types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
      onnotice: () => {},
    });
  }
  return globalForDb.__mapsSql;
}

/** Run fn in a transaction. Serialization failures are retried a few times. */
export async function tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await sql().begin(fn)) as T;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if ((code === "40001" || code === "40P01") && attempt < 3) continue;
      throw err;
    }
  }
}

export function pgCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}
export function pgConstraint(err: unknown): string | undefined {
  return (err as { constraint_name?: string })?.constraint_name;
}
