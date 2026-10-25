/**
 * GC-Stats - series-map-refs
 *
 * The map references of a series: a Valorant map, or a LoL game, with the
 * label the pickers and lists show. The database client is an argument: the
 * admin pages pass the uncached `adminDb`, the public pages the cached `db`.
 * The client module is only imported for its type, so the public read paths
 * never load the admin client.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { inArray, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { leagueTables, valorantTables } from "@gc-stats/db";
import { GAME_INFO, gameHasMaps, type GameSlug } from "@gc-stats/db/game";
import type { db } from "@gc-stats/db/client";

export type MapRefsClient = Pick<typeof db, "select">;
export type MapRef = { id: number; matchId: number; label: string };

/** "Ascent (Map 1)" for Valorant, "Game 1" for LoL. */
export function mapLabel(game: GameSlug, mapName: string | null, order: number): string {
  return gameHasMaps(game) ? `${mapName ?? "?"} (Map ${order})` : `${GAME_INFO[game].seriesUnit} ${order}`;
}

/** The series maps (Valorant maps, LoL games) matching `where`, in map order. */
export async function selectSeriesMaps(
  client: MapRefsClient,
  game: GameSlug,
  where: (columns: { id: AnyPgColumn; matchId: AnyPgColumn }) => SQL,
): Promise<{ id: number; matchId: number; mapName: string | null; order: number }[]> {
  if (gameHasMaps(game)) {
    const { maps } = valorantTables;
    return client.select({ id: maps.id, matchId: maps.matchId, mapName: maps.mapName, order: maps.order }).from(maps).where(where(maps)).orderBy(maps.order, maps.id);
  }
  const { games } = leagueTables;
  const rows = await client.select({ id: games.id, matchId: games.matchId, order: games.order }).from(games).where(where(games)).orderBy(games.order, games.id);
  return rows.map((g) => ({ ...g, mapName: null }));
}

/** The map references among `ids`, each with its match and label. */
export async function listMapRefs(client: MapRefsClient, game: GameSlug, ids: number[]): Promise<MapRef[]> {
  if (ids.length === 0) return [];
  const rows = await selectSeriesMaps(client, game, (t) => inArray(t.id, ids));
  return rows.map((m) => ({ id: m.id, matchId: m.matchId, label: mapLabel(game, m.mapName, m.order) }));
}
