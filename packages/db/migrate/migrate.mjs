/**
 * GC-Stats - migrate
 *
 * Applies the SQL migrations of ./drizzle, the same ones `drizzle-kit migrate` would. Runs in the `migrator` image
 * (Argo CD PreSync Job): plain JavaScript on `drizzle-orm` and `pg` only, no drizzle-kit, esbuild or tsx.
 * Same bookkeeping table (drizzle.__drizzle_migrations), so a database migrated by drizzle-kit carries on from where it is.
 * Once the migrations are applied, the permissions catalog is synced into the database (new permissions inserted and
 * given to the Super Admin role, nothing is ever removed).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
// Node strips the types natively. The image copies the catalog next to this file, a checkout reads it from src.
const permissionsUrl = existsSync(new URL("./permissions.ts", import.meta.url))
  ? new URL("./permissions.ts", import.meta.url)
  : new URL("../src/permissions.ts", import.meta.url);
const { ALL_PERMISSIONS } = await import(permissionsUrl.href);

/** Idempotent: safe to run on every deploy. */
async function syncPermissions(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO permissions (name) SELECT unnest($1::text[]) ON CONFLICT (name) DO NOTHING RETURNING name`,
      [ALL_PERMISSIONS]
    );
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
       WHERE r.is_super_admin AND p.name = ANY($1::text[])
       ON CONFLICT DO NOTHING`,
      [ALL_PERMISSIONS]
    );
    await client.query("COMMIT");
    console.log("Permissions synced (%d new)", rows.length);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

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
  await syncPermissions(pool);
} catch (error) {
  console.error("Migration failed", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
