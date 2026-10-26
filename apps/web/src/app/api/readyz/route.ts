/**
 * GC-Stats - readyz route
 *
 * Readiness probe: the database answers, otherwise the pod receives no traffic.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return new Response("ok", { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[readyz] database unavailable", error instanceof Error ? error.message : error);
    return new Response("database unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
