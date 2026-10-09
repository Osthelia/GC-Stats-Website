/**
 * GC-Stats - fetch-map-data
 *
 * Orchestrates fetching one map's data from the Riot relay: resolves the
 * tournament's region, pulls the raw match, resolves player identities
 * (failing with `missingPuuids`/`teamColorAmbiguous` when admin input is
 * needed), then stores the result and tries to auto-complete the match.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, isNull, or } from "drizzle-orm";
// adminDb: these reads must see writes made moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { maps, matches, stageContainers, stages, tournaments } from "@gc-stats/db";
import { getMatch, type RiotRelayRegion } from "@/lib/riot-relay-client";
import { getRiotContent, resolveAgentName } from "@/lib/riot-content-client";
import { maybeAutoCompleteMatchFromMaps } from "@/lib/bracket/auto-complete-match";
import { findMissingPuuids, findPersonIdsByPuuids, getEntrantPersonIds, persistPuuidMapping, resolveTeamAColor, type RiotPlayerRef, type ValIdColumn } from "./identity-resolution";
import { resolveRiotRegion } from "./riot-region";
import { storeMapData } from "./store-map-data";
import type { FetchMapResult } from "./types";

export interface FetchMapOptions {
  puuidMapping?: Map<string, number>;
  teamAColor?: "Red" | "Blue";
}

export async function fetchMapData(mapId: number, options: FetchMapOptions = {}): Promise<FetchMapResult> {
  const [row] = await db
    .select({
      mapId: maps.id,
      apiMatchId: maps.apiMatchId,
      matchId: matches.id,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      tournamentRegion: tournaments.region,
    })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(maps.id, mapId))
    .limit(1);

  if (!row) return { ok: false, error: { kind: "mapNotFound" } };
  if (!row.apiMatchId) return { ok: false, error: { kind: "noMatchId" } };
  if (row.entrantAId === null || row.entrantBId === null) return { ok: false, error: { kind: "entrantsNotSet" } };

  const region: RiotRelayRegion | null = resolveRiotRegion(row.tournamentRegion);
  if (!region) return { ok: false, error: { kind: "regionNotConfigured" } };

  const relayResult = await getMatch(region, row.apiMatchId);
  if (!relayResult.ok) return { ok: false, error: { kind: "relay", relayError: relayResult.error } };

  const match = relayResult.data;
  if (!match.matchInfo || !Array.isArray(match.players) || !Array.isArray(match.teams)) {
    return { ok: false, error: { kind: "invalidResponse" } };
  }

  // Content is fetched for the tournament's actual region, never `servedByRegion`:
  // "esports" is a valid match-v1 shard for the relay's retry but not a valid
  // content-v1 shard, so using it here would silently return empty content.
  const content = await getRiotContent(region);
  const column: ValIdColumn = relayResult.servedByRegion === "esports" ? "esportsValId" : "valId";

  const playerRefs: RiotPlayerRef[] = match.players
    .filter((p) => !p.isObserver)
    .map((p) => ({ puuid: p.puuid, gameName: p.gameName, tagLine: p.tagLine, teamId: p.teamId, characterId: p.characterId }));

  const manualMapping = options.puuidMapping ?? new Map<string, number>();
  if (manualMapping.size > 0) {
    const persistResult = await persistPuuidMapping(manualMapping, column);
    if (!persistResult.ok) return { ok: false, error: persistResult.error };
  }

  const known = await findPersonIdsByPuuids(
    playerRefs.map((p) => p.puuid),
    column
  );

  const missing = findMissingPuuids(playerRefs, known, new Map(), content);
  if (missing.length > 0) {
    return { ok: false, error: { kind: "missingPuuids", players: missing } };
  }

  const [entrantAPersonIds, entrantBPersonIds] = await Promise.all([getEntrantPersonIds(row.entrantAId), getEntrantPersonIds(row.entrantBId)]);
  const teamAColor = options.teamAColor ?? resolveTeamAColor(entrantAPersonIds, entrantBPersonIds, playerRefs, known);
  if (!teamAColor) {
    const rosters = (["Red", "Blue"] as const).map((color) => ({
      color,
      score: match.teams.find((t) => t.teamId === color)?.roundsWon ?? null,
      players: playerRefs.filter((p) => p.teamId === color).map((p) => ({ displayName: `${p.gameName}#${p.tagLine}`, agentName: resolveAgentName(content, p.characterId) })),
    }));
    return { ok: false, error: { kind: "teamColorAmbiguous", rosters } };
  }

  await storeMapData(match, {
    mapId: row.mapId,
    entrantAId: row.entrantAId,
    entrantBId: row.entrantBId,
    teamAColor,
    personIdByPuuid: known,
    content,
  });

  // "release-13.05-shipping-11-5350494" -> "13.05"
  const patch = match.matchInfo.gameVersion?.match(/^release-(\d+(?:\.\d+)*)/)?.[1];
  if (patch) {
    await db
      .update(matches)
      .set({ patch })
      .where(and(eq(matches.id, row.matchId), or(isNull(matches.patch), eq(matches.patch, ""))));
  }

  try {
    await maybeAutoCompleteMatchFromMaps(row.matchId);
  } catch (err) {
    console.warn(`[map-fetch] auto-complete failed for match #${row.matchId}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { ok: true };
}
