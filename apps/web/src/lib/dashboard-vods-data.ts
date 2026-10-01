/**
 * GC-Stats - dashboard-vods-data
 *
 * Query helpers for an organization's vods, joined with match and
 * tournament info for the dashboard listing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { desc, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { vods, matches, maps, entrants, stageContainers, stages, tournaments } from "@gc-stats/db";
import { normalizeScheduledAt } from "@/lib/match-schedule";

export type OrganizationVodRow = {
  id: number;
  url: string;
  languageCode: string;
  matchId: number;
  matchLabel: string;
  tournamentName: string;
  mapId: number | null;
  mapLabel: string | null;
  scheduledAt: string | null;
};

export async function listOrganizationVodRows(organizationId: number): Promise<OrganizationVodRow[]> {
  const rows = await db
    .select({
      id: vods.id,
      url: vods.url,
      languageCode: vods.languageCode,
      matchId: vods.matchId,
      mapId: vods.mapId,
      round: matches.round,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      tournamentName: tournaments.name,
      scheduledAt: matches.scheduledAt,
    })
    .from(vods)
    .innerJoin(matches, eq(matches.id, vods.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(vods.organizationId, organizationId))
    .orderBy(desc(vods.id));

  if (rows.length === 0) return [];

  const entrantIds = [...new Set(rows.flatMap((r) => [r.entrantAId, r.entrantBId]).filter((id): id is number => id !== null))];
  const entrantRows = entrantIds.length ? await db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, entrantIds)) : [];
  const entrantById = new Map(entrantRows.map((e) => [e.id, e.displayName]));

  const mapIds = rows.map((r) => r.mapId).filter((id): id is number => id !== null);
  const mapRows = mapIds.length ? await db.select({ id: maps.id, mapName: maps.mapName, order: maps.order }).from(maps).where(inArray(maps.id, mapIds)) : [];
  const mapById = new Map(mapRows.map((m) => [m.id, m]));

  return rows.map((r) => {
    const aName = r.entrantAId !== null ? (entrantById.get(r.entrantAId) ?? "TBD") : "TBD";
    const bName = r.entrantBId !== null ? (entrantById.get(r.entrantBId) ?? "TBD") : "TBD";
    const map = r.mapId !== null ? mapById.get(r.mapId) : undefined;
    return {
      id: r.id,
      url: r.url,
      // `language_code` is a fixed-width `char(5)` column, Postgres pads it
      // on read (e.g. "fr" -> "fr   ") — see the same trim in dashboard-streams-data.ts.
      languageCode: r.languageCode.trim(),
      matchId: r.matchId,
      matchLabel: `${aName} vs ${bName} (R${r.round})`,
      tournamentName: r.tournamentName,
      mapId: r.mapId,
      mapLabel: map ? `${map.mapName ?? "?"} (Map ${map.order})` : null,
      scheduledAt: normalizeScheduledAt(r.scheduledAt),
    };
  });
}

export type MatchMapOption = { id: number; label: string };

/** Backs the "specific map" <Select> once a match is picked in the add-VOD form. */
export async function getMatchMapOptions(matchId: number): Promise<MatchMapOption[]> {
  const rows = await db.select({ id: maps.id, mapName: maps.mapName, order: maps.order }).from(maps).where(eq(maps.matchId, matchId)).orderBy(maps.order);
  return rows.map((m) => ({ id: m.id, label: `${m.mapName ?? "?"} (Map ${m.order})` }));
}
