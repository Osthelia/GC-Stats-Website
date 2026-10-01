/**
 * GC-Stats - match-vetos
 *
 * Builds per-match map veto lists for the API v1/v2 match responses, falling
 * back to played maps when no veto process was recorded.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { matchVetos, maps } from "@gc-stats/db";
import { resolveEntrantTeamIds } from "../entrant-teams";

export type ApiMatchVeto = { match_id: number; team_id: number; map_name: string; type: string; order: number };

/**
 * Vetoes per match, id order — shared by `/teams/{id}/matches` and the V2
 * tournament matches endpoint. Older/untracked matches have no recorded veto
 * process, so matches missing from `match_vetos` fall back to the maps
 * actually played (`type: "played"`).
 */
export async function buildVetosByMatch(matchIds: number[]): Promise<Map<number, ApiMatchVeto[]>> {
  if (matchIds.length === 0) return new Map();

  const vetoRows = await db
    .select({ matchId: matchVetos.matchId, entrantId: matchVetos.entrantId, mapName: matchVetos.mapName, type: matchVetos.type, order: matchVetos.order })
    .from(matchVetos)
    .where(inArray(matchVetos.matchId, matchIds))
    .orderBy(asc(matchVetos.matchId), asc(matchVetos.order));

  const teamIdByEntrantId = await resolveEntrantTeamIds([...new Set(vetoRows.map((v) => v.entrantId))]);

  const vetosByMatch = new Map<number, ApiMatchVeto[]>();
  for (const v of vetoRows) {
    const list = vetosByMatch.get(v.matchId) ?? [];
    list.push({ match_id: v.matchId, team_id: teamIdByEntrantId.get(v.entrantId) ?? 0, map_name: v.mapName, type: v.type, order: v.order });
    vetosByMatch.set(v.matchId, list);
  }

  const missingVetoIds = matchIds.filter((id) => !vetosByMatch.has(id));
  const playedMapRows =
    missingVetoIds.length > 0
      ? await db
          .select({ matchId: maps.matchId, mapName: maps.mapName, order: maps.order })
          .from(maps)
          .where(inArray(maps.matchId, missingVetoIds))
          .orderBy(asc(maps.matchId), asc(maps.order))
      : [];
  for (const m of playedMapRows) {
    const list = vetosByMatch.get(m.matchId) ?? [];
    list.push({ match_id: m.matchId, team_id: 0, map_name: m.mapName ?? "", type: "played", order: m.order });
    vetosByMatch.set(m.matchId, list);
  }

  return vetosByMatch;
}
