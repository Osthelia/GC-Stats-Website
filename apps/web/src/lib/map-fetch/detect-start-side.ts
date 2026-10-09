/**
 * GC-Stats - detect-start-side
 *
 * Finds which entrant attacked first on a map from the Riot match alone, so
 * it works before any Riot data is stored: the map's own scores tell which
 * Riot team is entrant A, the first round tells which team attacked.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { maps, matches, stageContainers, stages, tournaments } from "@gc-stats/db";
import { computeRoundSides } from "@gc-stats/map-stats-engine";
import { getMatch } from "@/lib/riot-relay-client";
import { resolveRiotRegion } from "./riot-region";

/** The entrant (A or B) that started on attack, null when the map has no usable scores or the Riot match can't be read or matched. */
export async function detectStartingAttacker(mapId: number): Promise<"a" | "b" | null> {
  const [row] = await db
    .select({ apiMatchId: maps.apiMatchId, teamAScore: maps.teamAScore, teamBScore: maps.teamBScore, region: tournaments.region })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(maps.id, mapId))
    .limit(1);
  if (!row?.apiMatchId || row.teamAScore === null || row.teamBScore === null) return null;
  // A draw can't tell the teams apart.
  if (row.teamAScore === row.teamBScore) return null;

  const region = resolveRiotRegion(row.region);
  if (!region) return null;
  const result = await getMatch(region, row.apiMatchId);
  if (!result.ok || !Array.isArray(result.data.teams) || !Array.isArray(result.data.roundResults)) return null;
  const match = result.data;

  const red = match.teams.find((t) => t.teamId === "Red")?.roundsWon;
  const blue = match.teams.find((t) => t.teamId === "Blue")?.roundsWon;
  let teamAColor: "Red" | "Blue" | null = null;
  if (red === row.teamAScore && blue === row.teamBScore) teamAColor = "Red";
  else if (blue === row.teamAScore && red === row.teamBScore) teamAColor = "Blue";
  if (!teamAColor) return null;

  const first = [...match.roundResults].sort((x, y) => x.roundNum - y.roundNum)[0];
  if (!first) return null;
  const attacker = computeRoundSides(match.roundResults, match.players).get(first.roundNum)?.atk;
  if (!attacker) return null;
  return attacker === teamAColor ? "a" : "b";
}
