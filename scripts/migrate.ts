/**
 * Applies db/migrations/*.sql in order, once each, inside a transaction per
 * file, guarded by an advisory lock so concurrent deploys cannot race.
 * Usage: DATABASE_URL=... npm run db:migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function migrate(databaseUrl: string, ssl = false, log = console.log) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {}, ssl: ssl ? "require" : false });
  try {
    await sql`select pg_advisory_lock(727274)`;
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name as string));
    const dir = join(process.cwd(), "db", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const body = readFileSync(join(dir, file), "utf8");
      await sql.begin(async (t) => {
        await t.unsafe(body);
        await t`insert into schema_migrations (name) values (${file})`;
      });
      log(`applied ${file}`);
    }
    log("migrations up to date");
  } finally {
    await sql`select pg_advisory_unlock(727274)`.catch(() => {});
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  migrate(url, process.env.DATABASE_SSL === "require").catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
