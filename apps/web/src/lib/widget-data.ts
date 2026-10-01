/**
 * GC-Stats - widget-data
 *
 * Data queries for public OBS overlay widgets: heatmap positions (cached,
 * real query) and preview data (heatmap fake clusters, head-to-head latest
 * match) used before a widget's own filters are configured.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { unstable_cache } from "next/cache";
import { db } from "@gc-stats/db/client";
import { entrants, maps, mapPlayerStats, mapRoundPlayerPositionsRaw, mapRoundsRaw, matches } from "@gc-stats/db";
import { VALORANT_MINIMAPS, projectToMinimap } from "@/lib/valorant-minimaps";
import { visibleMatch } from "@/lib/ghost-visibility";

export type HeatmapPosition = { x: number; y: number; side: "atk" | "def" | null; eventType: string };

export type HeatmapFilters = {
  mapKey: string;
  tournamentId?: number;
  start?: Date;
  end?: Date;
  side?: "atk" | "def";
  teamId?: number;
  playerId?: number;
  eventTypes?: string[];
  agent?: string;
  timeStart?: number; // seconds
  timeEnd?: number; // seconds
  timeReference?: "round" | "plant";
};

/**
 * Mirrors V1's HeatmapService::positions() — filtered position snapshots
 * (kill/plant/defuse) converted from Riot's raw x/y into a normalized 0-1
 * position via the map's calibration coefficients. Capped at 5000 rows like
 * V1, for the same reason (this feeds a client-side canvas density plot,
 * not a table — no widget needs more points than that to look accurate).
 *
 * Cached for 5 minutes (mirrors V1's Cache::tags(['heatmap', ...])->remember(300, ...))
 * — an OBS Browser Source reloads/polls this URL repeatedly for as long as
 * a scene is live, and the underlying position history only grows between
 * completed maps, so re-running the full join on every paint is pure waste.
 */
export async function getHeatmapPositions(filters: HeatmapFilters): Promise<HeatmapPosition[]> {
  const cacheKey = JSON.stringify({ ...filters, start: filters.start?.toISOString(), end: filters.end?.toISOString() });
  const tags = ["heatmap", ...(filters.tournamentId != null ? [`tournament-${filters.tournamentId}`] : [])];
  return unstable_cache(() => computeHeatmapPositions(filters), ["heatmap-positions", cacheKey], { revalidate: 300, tags })();
}

async function computeHeatmapPositions(filters: HeatmapFilters): Promise<HeatmapPosition[]> {
  const calibration = VALORANT_MINIMAPS[filters.mapKey];
  if (!calibration) return [];

  const fromPlant = filters.timeReference === "plant";

  let teamEntrantIds: number[] | null = null;
  if (filters.teamId != null) {
    const rows = await db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, filters.teamId));
    teamEntrantIds = rows.map((r) => r.id);
    if (teamEntrantIds.length === 0) return [];
  }

  const rows = await db
    .select({
      x: mapRoundPlayerPositionsRaw.x,
      y: mapRoundPlayerPositionsRaw.y,
      eventType: mapRoundPlayerPositionsRaw.eventType,
      timeMs: mapRoundPlayerPositionsRaw.timeMs,
      plantTimeMs: mapRoundsRaw.plantTimeMs,
      atkEntrantId: mapRoundsRaw.atkEntrantId,
      defEntrantId: mapRoundsRaw.defEntrantId,
      statsEntrantId: mapPlayerStats.entrantId,
      agentName: mapPlayerStats.agentName,
    })
    .from(mapRoundPlayerPositionsRaw)
    .innerJoin(mapRoundsRaw, eq(mapRoundsRaw.id, mapRoundPlayerPositionsRaw.mapRoundId))
    .innerJoin(maps, eq(maps.id, mapRoundPlayerPositionsRaw.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .leftJoin(mapPlayerStats, and(eq(mapPlayerStats.mapId, mapRoundPlayerPositionsRaw.mapId), eq(mapPlayerStats.personId, mapRoundPlayerPositionsRaw.personId)))
    .where(
      and(
        sql`lower(${maps.mapName}) = ${filters.mapKey}`,
        fromPlant ? isNotNull(mapRoundsRaw.plantTimeMs) : undefined,
        filters.start && filters.end ? and(gte(matches.scheduledAt, filters.start), lte(matches.scheduledAt, filters.end)) : undefined,
        teamEntrantIds ? inArray(mapPlayerStats.entrantId, teamEntrantIds) : undefined,
        filters.playerId != null ? eq(mapRoundPlayerPositionsRaw.personId, filters.playerId) : undefined,
        filters.eventTypes && filters.eventTypes.length > 0 ? inArray(mapRoundPlayerPositionsRaw.eventType, filters.eventTypes) : undefined,
        filters.agent ? eq(mapPlayerStats.agentName, filters.agent) : undefined,
      ),
    )
    .orderBy(desc(mapRoundPlayerPositionsRaw.id))
    .limit(5000);

  return rows
    .filter((row) => {
      if (filters.side === "atk" && row.statsEntrantId !== row.atkEntrantId) return false;
      if (filters.side === "def" && row.statsEntrantId !== row.defEntrantId) return false;
      if (filters.timeStart != null || filters.timeEnd != null) {
        const base = fromPlant ? (row.timeMs ?? 0) - (row.plantTimeMs ?? 0) : (row.timeMs ?? 0);
        const seconds = base / 1000;
        if (filters.timeStart != null && seconds < filters.timeStart) return false;
        if (filters.timeEnd != null && seconds > filters.timeEnd) return false;
      }
      return true;
    })
    .map((row) => {
      const { x, y } = projectToMinimap(calibration, row.x, row.y);
      const side: "atk" | "def" | null = row.statsEntrantId == null ? null : row.statsEntrantId === row.atkEntrantId ? "atk" : row.statsEntrantId === row.defEntrantId ? "def" : null;
      return { x, y, side, eventType: row.eventType };
    });
}

/**
 * Fabricated data for the widgets directory's live thumbnail and the
 * builder's "no filters chosen yet" preview — an unfiltered real query can
 * scan a map's entire position history (see getHeatmapPositions' 5000-row
 * cap, which only helps once a map is already selected), so this never
 * touches the database. Ported 1:1 from V1's WidgetController::heatmapPreview().
 */
export function getHeatmapPreviewPositions(): HeatmapPosition[] {
  const clusters = [
    { x: 0.3, y: 0.24 },
    { x: 0.62, y: 0.71 },
    { x: 0.46, y: 0.48 },
  ];
  const eventTypes = ["kill", "plant", "defuse"];

  function gaussianJitter(): number {
    const u1 = Math.max(1e-9, Math.random());
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * 0.06;
  }

  const positions: HeatmapPosition[] = [];
  for (let i = 1; i <= 260; i++) {
    const cluster = clusters[Math.floor(Math.random() * clusters.length)]!;
    positions.push({
      x: Math.min(1, Math.max(0, cluster.x + gaussianJitter())),
      y: Math.min(1, Math.max(0, cluster.y + gaussianJitter())),
      side: i % 2 === 0 ? "atk" : "def",
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)]!,
    });
  }
  return positions;
}

export type WidgetPreviewMatch = { teamAId: number; teamBId: number };

/** Latest finished match between two real teams — feeds the head-to-head directory card's live iframe preview (mirrors V1's $previewMatch). */
export async function getWidgetPreviewMatch(): Promise<WidgetPreviewMatch | null> {
  const entrantA = alias(entrants, "entrant_a");
  const entrantB = alias(entrants, "entrant_b");

  const [row] = await db
    .select({ teamAId: entrantA.teamId, teamBId: entrantB.teamId })
    .from(matches)
    .innerJoin(entrantA, eq(entrantA.id, matches.entrantAId))
    .innerJoin(entrantB, eq(entrantB.id, matches.entrantBId))
    .where(and(isNotNull(entrantA.teamId), isNotNull(entrantB.teamId), eq(matches.status, "completed"), visibleMatch))
    .orderBy(desc(matches.scheduledAt))
    .limit(1);
  if (!row || row.teamAId == null || row.teamBId == null) return null;
  return { teamAId: row.teamAId, teamBId: row.teamBId };
}
