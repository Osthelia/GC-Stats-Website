/**
 * GC-Stats — client module
 *
 * Provides the drizzle `db` (and `adminDb`, cache bypassed) clients used
 * across the app. Picks between a Node pg.Pool (self-hosted Docker) and a
 * per-request Hyperdrive-backed pool (Cloudflare Workers) depending on
 * environment.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

// Minimal local shape instead of the ambient `CloudflareEnv` global (only fully
// declared where `wrangler types` ran, i.e. apps/web) so this file type checks
// the same whether compiled standalone (this package) or bundled into apps/web.
interface WorkersEnv {
  HYPERDRIVE: { connectionString: string };
  // Same Neon database as HYPERDRIVE, caching disabled — see `adminDb` below.
  HYPERDRIVE_ADMIN: { connectionString: string };
}

// Self-hosted Docker deploy: one process, one pool, reused across Next.js dev
// hot-reloads via `globalThis` — without this, every module reload would open
// a fresh pg.Pool and eventually exhaust Postgres' connection limit. Shared by
// both `db` and `adminDb`: outside Workers there's no Hyperdrive query cache
// to route around, so a single direct Postgres pool is always fresh.
declare global {
  // eslint-disable-next-line no-var
  var __gcStatsDbPool: Pool | undefined;
}

let nodeDb: Db | undefined;
function getNodeDb(): Db {
  if (!nodeDb) {
    const pool = globalThis.__gcStatsDbPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
    if (process.env.NODE_ENV !== "production") {
      globalThis.__gcStatsDbPool = pool;
    }
    nodeDb = drizzle(pool, { schema });
  }
  return nodeDb;
}

// Cloudflare Workers has no long-lived process to reuse a pool across requests
// — each request gets its own Hyperdrive-backed pool (`maxUses: 1`, per
// OpenNext's recommended pattern), memoized for the request's lifetime.
// Keyed on the request's ExecutionContext rather than React `cache`, which is
// a no-op outside RSC renders (route handlers, cron): there, every `db.*`
// call rebuilt a Pool and drizzle's whole relational schema.
function makeWorkersDbFactory(getConnectionString: (env: WorkersEnv) => string) {
  const perRequest = new WeakMap<object, Db>();
  return (): Db => {
    const { env, ctx } = getCloudflareContext();
    const cached = ctx ? perRequest.get(ctx) : undefined;
    if (cached) return cached;

    const connectionString = getConnectionString(env as unknown as WorkersEnv);
    const pool = new Pool({ connectionString, maxUses: 1 });
    const instance = drizzle(pool, { schema });
    if (ctx) perRequest.set(ctx, instance);
    return instance;
  };
}

const getWorkersDb = makeWorkersDbFactory((env) => env.HYPERDRIVE.connectionString);
const getWorkersAdminDb = makeWorkersDbFactory((env) => env.HYPERDRIVE_ADMIN.connectionString);

function resolveDb(): Db {
  return process.env.DEPLOY_TARGET === "cloudflare" ? getWorkersDb() : getNodeDb();
}

function resolveAdminDb(): Db {
  return process.env.DEPLOY_TARGET === "cloudflare" ? getWorkersAdminDb() : getNodeDb();
}

// Proxy so every call site keeps a single static `import { db }` without
// knowing which runtime/pool is behind it. Forwards every trap, not just
// `get` — libraries like @auth/drizzle-adapter identify the dialect via
// `Object.getPrototypeOf(db)` (drizzle-orm's `is()` helper), which bypasses
// a `get`-only proxy and would resolve against the empty `{}` target instead.
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

// General purpose client — cached at the Hyperdrive layer on Workers (60s
// max_age/15s stale_while_revalidate), fine for public reads. Never assume a
// write is visible through this client right after it happens.
export const db: Db = makeDbProxy(resolveDb);

// Same Neon database, routed through a caching-disabled Hyperdrive config on
// Workers (HYPERDRIVE_ADMIN) — Hyperdrive never invalidates its cache on
// writes, so any read that must reflect a just-made change (RBAC/access
// checks, admin panels, the dashboard) has to go through this client instead
// of `db`. See wrangler.jsonc for the second hyperdrive binding.
export const adminDb: Db = makeDbProxy(resolveAdminDb);
