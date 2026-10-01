/**
 * GC-Stats — connection
 *
 * Shared V1 (MySQL) and V2 (Postgres/Neon, via drizzle) connections used by
 * every migrate-v1 script. Uses a Pool rather than a single Client on the
 * V2 side since Neon can drop an idle connection mid-script.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/schema";

if (!process.env.V1_DATABASE_URL) throw new Error("V1_DATABASE_URL is not set (packages/db/.env)");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (packages/db/.env)");

export const v1 = await mysql.createPool(process.env.V1_DATABASE_URL);

// Pool, not a single long-lived Client: Neon (serverless Postgres) can drop
// an idle connection mid-script (e.g. while a long phase runs, or while
// this script sits idle between chunks), and a bare Client just hangs
// forever on the next query over a dead socket — no default timeout. A Pool
// hands out a fresh connection per query and retries on a dead one.
// statement_timeout aborts any single query that hangs server-side instead
// of hanging this script indefinitely.
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  statement_timeout: 60_000,
  query_timeout: 60_000,
  keepAlive: true,
});
export const db = drizzle(pgPool, { schema });
export const pgRaw = pgPool;

export async function closeConnections() {
  await v1.end();
  await pgPool.end();
}
