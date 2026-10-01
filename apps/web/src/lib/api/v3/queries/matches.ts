/**
 * GC-Stats - matches
 *
 * Query helpers for the API v3 match response: adds head to head encounter
 * history and pick'em vote tallies on top of the v1 match stats response.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { matches, pickemMatchPicks } from "@gc-stats/db";
import { getMatchStatsResponse, type ApiMatchStatsResponse } from "../../v1/queries/matches";
import { getMatchEncounters } from "@/lib/match-page-data";
import { buildHeadToHeadWidgetUrl } from "@/lib/widget-params";
import { APP_BASE_URL } from "@/lib/notify";

export type ApiMatchEncounter = {
  match_id: number;
  scheduled_at: string | null;
  tournament_name: string;
  score_a: number | null;
  score_b: number | null;
  result: "win" | "loss" | "draw";
};

export type ApiMatchEncounters = {
  team_a_wins: number;
  team_b_wins: number;
  items: ApiMatchEncounter[];
};

export type ApiPickemVotes = {
  team_a: number;
  team_b: number;
  total: number;
  team_a_percentage: number;
  team_b_percentage: number;
};

export type ApiMatchV3Response = ApiMatchStatsResponse & {
  encounters: ApiMatchEncounters;
  radar_chart_widget_url: string | null;
  pickem: ApiPickemVotes;
};

function roundPct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

async function getMatchPickemVotes(matchId: number, entrantAId: number | null, entrantBId: number | null): Promise<ApiPickemVotes> {
  if (entrantAId == null && entrantBId == null) return { team_a: 0, team_b: 0, total: 0, team_a_percentage: 0, team_b_percentage: 0 };

  const rows = await db
    .select({ entrantId: pickemMatchPicks.predictedWinnerEntrantId, count: sql<number>`count(*)` })
    .from(pickemMatchPicks)
    .where(eq(pickemMatchPicks.matchId, matchId))
    .groupBy(pickemMatchPicks.predictedWinnerEntrantId);

  let teamA = 0;
  let teamB = 0;
  for (const row of rows) {
    if (row.entrantId === entrantAId) teamA = Number(row.count);
    else if (row.entrantId === entrantBId) teamB = Number(row.count);
  }
  const total = teamA + teamB;
  return { team_a: teamA, team_b: teamB, total, team_a_percentage: roundPct(teamA, total), team_b_percentage: roundPct(teamB, total) };
}

/**
 * V3 = V2's full stats response, plus everything the public match page shows
 * beyond raw stats: past head to head encounters, a ready made link to the
 * OBS head to head radar chart widget (the API has no chart rendering of its
 * own), and the pick'em vote split for this match.
 */
export async function getMatchV3Response(matchId: number): Promise<ApiMatchV3Response | null> {
  const core = await getMatchStatsResponse(matchId);
  if (!core) return null;

  const [matchRow] = await db.select({ entrantAId: matches.entrantAId, entrantBId: matches.entrantBId }).from(matches).where(eq(matches.id, matchId)).limit(1);

  const teamAId = core.team_a?.team.id ?? null;
  const teamBId = core.team_b?.team.id ?? null;

  const [encounters, pickem] = await Promise.all([
    getMatchEncounters(matchId, teamAId, teamBId),
    getMatchPickemVotes(matchId, matchRow?.entrantAId ?? null, matchRow?.entrantBId ?? null),
  ]);

  const radarChartWidgetUrl = teamAId != null && teamBId != null ? `${APP_BASE_URL}${buildHeadToHeadWidgetUrl({ teamA: teamAId, teamB: teamBId })}` : null;

  return {
    ...core,
    encounters: {
      team_a_wins: encounters.teamAWins,
      team_b_wins: encounters.teamBWins,
      items: encounters.items.map((item) => ({
        match_id: item.id,
        scheduled_at: item.scheduledAt ? item.scheduledAt.toISOString() : null,
        tournament_name: item.tournamentName,
        score_a: item.scoreA,
        score_b: item.scoreB,
        result: item.result,
      })),
    },
    radar_chart_widget_url: radarChartWidgetUrl,
    pickem,
  };
}
