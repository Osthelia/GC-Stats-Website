/**
 * GC-Stats - backfill-match-patch
 *
 * Fills `matches.patch` for every match with an empty patch, using the
 * `gameVersion` of its first fetchable map (ex. "release-13.05-shipping-11-5350494" gives "13.05").
 * Only the patch is written, a match that already has one is never touched.
 *
 * Usage (from apps/web): npm run backfill:patch [-- --dry-run]
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { maps, matches, stageContainers, stages, tournaments } from "@gc-stats/db";
import { getMatch } from "../src/lib/riot-relay-client";
import { resolveRiotRegion } from "../src/lib/map-fetch/riot-region";

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_RATE_LIMIT_RETRIES = 3;

function parsePatch(gameVersion: string | undefined): string | null {
  return gameVersion?.match(/^release-(\d+(?:\.\d+)*)/)?.[1] ?? null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPatch(region: NonNullable<ReturnType<typeof resolveRiotRegion>>, apiMatchId: string): Promise<{ patch: string | null; error: string | null }> {
  for (let attempt = 0; ; attempt++) {
    const result = await getMatch(region, apiMatchId);
    if (result.ok) return { patch: parsePatch(result.data.matchInfo?.gameVersion), error: null };
    if (result.error.kind === "rateLimited" && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep((result.error.retryAfterSeconds ?? 5) * 1000);
      continue;
    }
    return { patch: null, error: result.error.kind };
  }
}

async function main() {
  const rows = await db
    .select({
      matchId: matches.id,
      mapId: maps.id,
      apiMatchId: maps.apiMatchId,
      tournamentRegion: tournaments.region,
    })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(and(isNotNull(maps.apiMatchId), or(isNull(matches.patch), eq(matches.patch, ""))))
    .orderBy(asc(matches.id), asc(maps.id));

  const mapsByMatch = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = mapsByMatch.get(row.matchId) ?? [];
    list.push(row);
    mapsByMatch.set(row.matchId, list);
  }

  console.log(`${mapsByMatch.size} match(es) without patch${DRY_RUN ? " (dry run)" : ""}`);

  let updated = 0;
  let unresolved = 0;

  for (const [matchId, matchMaps] of mapsByMatch) {
    let patch: string | null = null;
    let lastError: string | null = null;

    for (const map of matchMaps) {
      const region = resolveRiotRegion(map.tournamentRegion);
      if (!region || !map.apiMatchId) {
        lastError = "regionNotConfigured";
        continue;
      }
      const result = await fetchPatch(region, map.apiMatchId);
      if (result.patch) {
        patch = result.patch;
        break;
      }
      lastError = result.error ?? "noGameVersion";
    }

    if (!patch) {
      unresolved++;
      console.warn(`match #${matchId}: skipped (${lastError})`);
      continue;
    }

    if (!DRY_RUN) {
      await db
        .update(matches)
        .set({ patch })
        .where(and(eq(matches.id, matchId), or(isNull(matches.patch), eq(matches.patch, ""))));
    }
    updated++;
    console.log(`match #${matchId}: patch ${patch}`);
  }

  console.log(`Done: ${updated} updated, ${unresolved} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
