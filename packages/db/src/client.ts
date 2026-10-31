/**
 * GC-Stats — client module
 *
 * Provides the drizzle `db` client used across the app: one pg.Pool per Node
 * process (size from DATABASE_POOL_SIZE), pointed at PgBouncer in the cluster,
 * plus a separate small pool for the OpenData portal (OPENDATA_DATABASE_POOL_SIZE).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

// One process, one pool, reused across Next.js dev hot-reloads via `globalThis`
// — without this, every module reload would open a fresh pg.Pool and
// eventually exhaust Postgres' connection limit.
declare global {
  // eslint-disable-next-line no-var
  var __gcStatsDbPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __gcStatsOpenDataDbPool: Pool | undefined;
}

// Without a listener, an idle client's socket error (connection dropped by
// Postgres/PgBouncer) is rethrown by EventEmitter as an unhandled rejection.
// The pool already discards the broken client, so logging is enough.
function attachPoolErrorHandler(pool: Pool): Pool {
  pool.on("error", (err) => console.warn("[db] idle client error:", err.message));
  return pool;
}

function createPool(sizeEnv: string | undefined, fallbackMax?: number): Pool {
  const parsed = Number.parseInt(sizeEnv ?? "", 10);
  const max = parsed > 0 ? parsed : fallbackMax;
  return attachPoolErrorHandler(new Pool({ connectionString: process.env.DATABASE_URL, ...(max ? { max } : {}) }));
}

let mainPool: Pool | undefined;
function getMainPool(): Pool {
  if (!mainPool) {
    mainPool = globalThis.__gcStatsDbPool ?? createPool(process.env.DATABASE_POOL_SIZE);
    if (process.env.NODE_ENV !== "production") {
      globalThis.__gcStatsDbPool = mainPool;
    }
  }
  return mainPool;
}

let instance: Db | undefined;
function getDb(): Db {
  if (!instance) {
    instance = drizzle(getMainPool(), { schema });
  }
  return instance;
}

// OpenData gets its own small pool: a burst of exports can only wait on these
// few connections, never take one the site needs.
let openDataInstance: Db | undefined;
function getOpenDataDb(): Db {
  if (!openDataInstance) {
    const pool = globalThis.__gcStatsOpenDataDbPool ?? createPool(process.env.OPENDATA_DATABASE_POOL_SIZE, 2);
    if (process.env.NODE_ENV !== "production") {
      globalThis.__gcStatsOpenDataDbPool = pool;
    }
    openDataInstance = drizzle(pool, { schema });
  }
  return openDataInstance;
}

export type DbPoolStats = { total: number; idle: number; waiting: number; max: number };

/** Main pool usage of this process. `waiting` above 0 means site queries are queuing for a connection. */
export function getDbPoolStats(): DbPoolStats {
  const pool = getMainPool();
  return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max ?? 10 };
}

// Proxy so the pool is only created on first use (not while `next build`
// collects page data) and every call site keeps a single static
// `import { db }`. Forwards every trap, not just `get` — libraries like
// @auth/drizzle-adapter identify the dialect via `Object.getPrototypeOf(db)`
// (drizzle-orm's `is()` helper), which bypasses a `get`-only proxy and would
// resolve against the empty `{}` target instead.
function makeDbProxy(resolve: () => Db): Db {
  return new Proxy({} as Db, {
    get(_target, prop) {
      const real = resolve();
      const value = Reflect.get(real, prop, real);
      return typeof value === "function" ? value.bind(real) : value;
    },
    has(_target, prop) {
      return Reflect.has(resolve(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(resolve());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(resolve(), prop);
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(resolve());
    },
    set(_target, prop, value) {
      return Reflect.set(resolve(), prop, value);
    },
  }) as Db;
}

export const db: Db = makeDbProxy(getDb);

/** Read only client for the OpenData portal, see getOpenDataDb. */
export const openDataDb: Db = makeDbProxy(getOpenDataDb);

// Historical name: a second client used to bypass a query cache in front of the
// database (Hyperdrive). There is none anymore, so it is the same client; the
// alias stays so call sites that need read-your-writes keep saying so.
export const adminDb: Db = db;
