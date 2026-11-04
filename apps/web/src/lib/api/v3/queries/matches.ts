/**
 * GC-Stats - matches
 *
 * Query helpers for the API v3 match response: adds head to head encounter
 * history and pick'em vote tallies on top of the v1 match stats response.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { matches, pickemMatchPicks } from "@gc-stats/db";
import { getMatchStatsResponse, type ApiMatchStatsResponse, type ApiMapPlayerStat } from "../../v1/queries/matches";
import { RatingAccumulator } from "../../v1/rating";
import { getMatchesV2 } from "../../v2/queries/matches";
import type { MatchesFilter } from "../../v2/params";
import { getMatchMedia, type ApiMatchMedia } from "./match-media";
import { withPhase, withPhasesPaginated, type WithPhase } from "./phases";
import { getMatchEncounters } from "@/lib/match-page-data";
import { buildHeadToHeadWidgetUrl } from "@/lib/widget-params";

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

/** A player's stats combined over every completed map of the match. */
export type ApiMatchPlayerTotals = {
  person_id: number;
  team_id: number;
  agents: string[];
  maps_played: number;
  kills: number;
  deaths: number;
  assists: number;
  kd_ratio: number | null;
  acs: number;
  adr: number;
  first_kills: number;
  first_deaths: number;
  kast_percentage: number;
  headshot_percentage: number;
  rating: number | null;
  rating_rounds: number | null;
};

export type ApiMatchV3Response = WithPhase<ApiMatchStatsResponse> &
  ApiMatchMedia & {
    player_stats: ApiMatchPlayerTotals[];
    encounters: ApiMatchEncounters;
    radar_chart_widget_url: string | null;
    pickem: ApiPickemVotes;
  };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Totals summed, ACS/ADR/KAST/HS% and rating weighted by rounds played, team taken from the map with the most rounds. Only completed maps count. */
function aggregateMatchPlayerStats(mapsStats: ApiMatchStatsResponse["maps"]): ApiMatchPlayerTotals[] {
  type Agg = { rows: { stat: ApiMapPlayerStat; weight: number }[]; rating: RatingAccumulator; agents: Set<string> };
  const byPlayer = new Map<number, Agg>();
  for (const map of mapsStats) {
    if (!map.is_completed) continue;
    for (const stat of map.player_stats) {
      if (stat.person_id == null) continue;
      const agg = byPlayer.get(stat.person_id) ?? { rows: [], rating: new RatingAccumulator(), agents: new Set<string>() };
      agg.rows.push({ stat, weight: Math.max(map.rounds.length, 1) });
      agg.rating.add(stat.rating, stat.rating_rounds);
      if (stat.agent_name) agg.agents.add(stat.agent_name);
      byPlayer.set(stat.person_id, agg);
    }
  }

  const avg = (rows: Agg["rows"], pick: (r: ApiMapPlayerStat) => number) => {
    const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
    return round1(rows.reduce((sum, r) => sum + pick(r.stat) * r.weight, 0) / totalWeight);
  };

  return [...byPlayer.entries()].map(([personId, { rows, rating, agents }]) => {
    const stats = rows.map((r) => r.stat);
    const kills = stats.reduce((sum, r) => sum + r.kills, 0);
    const deaths = stats.reduce((sum, r) => sum + r.deaths, 0);
    const main = rows.reduce((best, r) => (r.weight > best.weight ? r : best));
    return {
      person_id: personId,
      team_id: main.stat.team_id,
      agents: [...agents],
      maps_played: rows.length,
      kills,
      deaths,
      assists: stats.reduce((sum, r) => sum + r.assists, 0),
      kd_ratio: deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : null,
      acs: avg(rows, (r) => r.acs),
      adr: avg(rows, (r) => r.adr),
      first_kills: stats.reduce((sum, r) => sum + r.first_kills, 0),
      first_deaths: stats.reduce((sum, r) => sum + r.first_deaths, 0),
      kast_percentage: avg(rows, (r) => r.kast_percentage),
      headshot_percentage: avg(rows, (r) => r.headshot_percentage),
      rating: rating.value,
      rating_rounds: rating.ratedRounds > 0 ? rating.ratedRounds : null,
    };
  });
}

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
 * V3 = V2's full stats response with `phase` (id, name, type, ...) and the
 * match's `container` (with its chain of sets) instead of `phase_id`, plus
 * everything the public match page shows beyond raw stats: streams, player
 * POVs and VODs, past head to head encounters, a ready made link to the OBS
 * head to head radar chart widget (the API has no chart rendering of its
 * own), and the pick'em vote split for this match.
 */
export async function getMatchV3Response(matchId: number): Promise<ApiMatchV3Response | null> {
  const stats = await getMatchStatsResponse(matchId);
  if (!stats) return null;

  const [matchRow] = await db.select({ entrantAId: matches.entrantAId, entrantBId: matches.entrantBId }).from(matches).where(eq(matches.id, matchId)).limit(1);

  const teamAId = stats.team_a?.team.id ?? null;
  const teamBId = stats.team_b?.team.id ?? null;

  const [core, media, encounters, pickem] = await Promise.all([
    withPhase(stats),
    getMatchMedia(matchId),
    getMatchEncounters(matchId, teamAId, teamBId),
    getMatchPickemVotes(matchId, matchRow?.entrantAId ?? null, matchRow?.entrantBId ?? null),
  ]);

  const radarChartWidgetUrl = teamAId != null && teamBId != null ? buildHeadToHeadWidgetUrl({ teamA: teamAId, teamB: teamBId }) : null;

  return {
    ...core,
    ...media,
    player_stats: aggregateMatchPlayerStats(stats.maps),
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

/** V2 global match listing with `phase` and `container` instead of `phase_id`. */
export async function getMatchesV3(filter: MatchesFilter) {
  return withPhasesPaginated(await getMatchesV2(filter));
}
