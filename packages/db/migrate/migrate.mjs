/**
 * GC-Stats - migrate
 *
 * Applies the SQL migrations of ./drizzle, the same ones `drizzle-kit migrate` would. Runs in the `migrator` image
 * (Argo CD PreSync Job): plain JavaScript on `drizzle-orm` and `pg` only, no drizzle-kit, esbuild or tsx.
 * Same bookkeeping table (drizzle.__drizzle_migrations), so a database migrated by drizzle-kit carries on from where it is.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

// Migrations are not run through PgBouncer: DATABASE_URL must point at the primary directly.
const pool = new pg.Pool({ connectionString, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL("./drizzle", import.meta.url)) });
  console.log("Migrations applied");
} catch (error) {
  console.error("Migration failed", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
