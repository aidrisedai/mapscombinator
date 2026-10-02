import postgres from "postgres";
import { migrate } from "../scripts/migrate";

/** Recreates the test database schema from migrations before the run. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/maps_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema public cascade; create schema public;");
  await sql.end();
  await migrate(url, false, () => {});
}
