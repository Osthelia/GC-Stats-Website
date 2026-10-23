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

import { desc, eq, inArray, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables, leagueTables, valorantTables } from "@gc-stats/db";
import { normalizeScheduledAt } from "@/lib/match-schedule";
import { GAME_INFO, gameHasMaps, type GameSlug } from "@gc-stats/db/game";

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

export async function listOrganizationVodRows(game: GameSlug, organizationId: number): Promise<OrganizationVodRow[]> {
  const { vods, matches, entrants, stageContainers, stages, tournaments } = gameTables(game);
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
  const mapLabelById = new Map((await listMapRefs(game, mapIds)).map((m) => [m.id, m.label]));

  return rows.map((r) => {
    const aName = r.entrantAId !== null ? (entrantById.get(r.entrantAId) ?? "TBD") : "TBD";
    const bName = r.entrantBId !== null ? (entrantById.get(r.entrantBId) ?? "TBD") : "TBD";
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
      mapLabel: r.mapId !== null ? (mapLabelById.get(r.mapId) ?? null) : null,
      scheduledAt: normalizeScheduledAt(r.scheduledAt),
    };
  });
}

export type MatchMapOption = { id: number; label: string };

/** A map reference: a Valorant map, or a LoL game (`lol_games`), with its match and the label the pickers and lists show. */
export type MapRef = { id: number; matchId: number; label: string };

/** "Ascent (Map 1)" for Valorant, "Game 1" for LoL. */
function mapLabel(game: GameSlug, mapName: string | null, order: number): string {
  return gameHasMaps(game) ? `${mapName ?? "?"} (Map ${order})` : `${GAME_INFO[game].seriesUnit} ${order}`;
}

/** The series maps (Valorant maps, LoL games) matching `where`, in map order. */
async function selectSeriesMaps(game: GameSlug, where: (columns: { id: AnyPgColumn; matchId: AnyPgColumn }) => SQL): Promise<{ id: number; matchId: number; mapName: string | null; order: number }[]> {
  if (gameHasMaps(game)) {
    const { maps } = valorantTables;
    return db.select({ id: maps.id, matchId: maps.matchId, mapName: maps.mapName, order: maps.order }).from(maps).where(where(maps)).orderBy(maps.order, maps.id);
  }
  const { games } = leagueTables;
  const rows = await db.select({ id: games.id, matchId: games.matchId, order: games.order }).from(games).where(where(games)).orderBy(games.order, games.id);
  return rows.map((g) => ({ ...g, mapName: null }));
}

/** The map references among `ids`, each with its match and label. */
export async function listMapRefs(game: GameSlug, ids: number[]): Promise<MapRef[]> {
  if (ids.length === 0) return [];
  const rows = await selectSeriesMaps(game, (t) => inArray(t.id, ids));
  return rows.map((m) => ({ id: m.id, matchId: m.matchId, label: mapLabel(game, m.mapName, m.order) }));
}

/** Backs the "specific map" <Select> once a match is picked: its maps (Valorant) or games (LoL). */
export async function getMatchMapOptions(game: GameSlug, matchId: number): Promise<MatchMapOption[]> {
  const rows = await selectSeriesMaps(game, (t) => eq(t.matchId, matchId));
  return rows.map((m) => ({ id: m.id, label: mapLabel(game, m.mapName, m.order) }));
}
