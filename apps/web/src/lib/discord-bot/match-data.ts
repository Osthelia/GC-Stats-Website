/**
 * GC-Stats - match-data
 *
 * Loads matches as the bot shows them: teams, logos, maps, vetos and MVPs.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, exists, gte, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { getCurrentLogoUrls } from "@/lib/admin-logos";
import { valorantTables } from "@gc-stats/db";
import type { AlertMatch, AlertMvp } from "./render";

const { entrants, mapPlayerStats, maps, matchVetos, matches, people, stageContainers, stages, teams, tournaments } = valorantTables;

/** A finished match older than this is never announced, so enabling an alert does not replay history. */
const FINISHED_WINDOW_HOURS = 6;
// Match the dashboard preview is filled with, overridable per environment.
const DEFAULT_PREVIEW_MATCH_ID = 16786;

export type MatchContext = { match: AlertMatch; region: string | null; official: boolean; teamIds: number[] };

type StatRow = { mapId: number; entrantId: number | null; key: string; personId: number | null; handle: string; acs: number; agentName: string | null };
// The player picture is filled in once every MVP is known.
type MvpDraft = AlertMvp & { personId: number | null };

type PlayerTotal = { handle: string; personId: number | null; sum: number; n: number; agents: Map<string, number> };

function mostPlayed(agents: Map<string, number>): string | null {
  return [...agents.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

type Mvps = { byMap: Map<number, MvpDraft>; byMatch: Map<number, MvpDraft> };

/** MVP of each map (best ACS) and of each match (best average ACS over its maps). */
function computeMvps(statRows: StatRow[], mapRows: { id: number; matchId: number }[]): Mvps {
  const matchOfMap = new Map(mapRows.map((m) => [m.id, m.matchId]));
  const byMap = new Map<number, MvpDraft>();
  const totals = new Map<number, Map<string, PlayerTotal>>();
  for (const row of statRows) {
    const best = byMap.get(row.mapId);
    if (!best || row.acs > best.acs) byMap.set(row.mapId, { handle: row.handle, acs: row.acs, agentName: row.agentName, personId: row.personId, imageUrl: null });

    const matchId = matchOfMap.get(row.mapId);
    if (matchId === undefined) continue;
    const players = totals.get(matchId) ?? new Map<string, PlayerTotal>();
    const player = players.get(row.key) ?? { handle: row.handle, personId: row.personId, sum: 0, n: 0, agents: new Map<string, number>() };
    player.sum += row.acs;
    player.n += 1;
    if (row.agentName) player.agents.set(row.agentName, (player.agents.get(row.agentName) ?? 0) + 1);
    players.set(row.key, player);
    totals.set(matchId, players);
  }

  const byMatch = new Map<number, MvpDraft>();
  for (const [matchId, players] of totals) {
    for (const p of players.values()) {
      const acs = Math.round(p.sum / p.n);
      const best = byMatch.get(matchId);
      if (!best || acs > best.acs) byMatch.set(matchId, { handle: p.handle, acs, agentName: mostPlayed(p.agents), personId: p.personId, imageUrl: null });
    }
  }
  return { byMap, byMatch };
}

/** Live and recently finished matches (scheduled or played a map within the window), or only the given match whatever its state. */
export async function loadMatchContexts(onlyMatchId?: number): Promise<MatchContext[]> {
  const since = new Date(Date.now() - FINISHED_WINDOW_HOURS * 60 * 60 * 1000);
  const scope: SQL | undefined = onlyMatchId !== undefined ? eq(matches.id, onlyMatchId) : or(eq(matches.status, "live"), and(eq(matches.status, "completed"), or(gte(matches.scheduledAt, since), exists(db.select({ one: maps.id }).from(maps).where(and(eq(maps.matchId, matches.id), gte(maps.startedAt, since)))))));
  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      bestOf: matches.bestOf,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      tournamentName: tournaments.name,
      stageName: stages.name,
      scheduledAt: matches.scheduledAt,
      region: tournaments.region,
      official: tournaments.isOfficial,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(scope);
  if (rows.length === 0) return [];

  const entrantIds = [...new Set(rows.flatMap((r) => [r.entrantAId, r.entrantBId]).filter((id): id is number => id !== null))];
  const entrantRows = entrantIds.length
    ? await db
        .select({ id: entrants.id, name: entrants.displayName, shortName: teams.shortName, teamId: entrants.teamId })
        .from(entrants)
        .leftJoin(teams, eq(teams.id, entrants.teamId))
        .where(inArray(entrants.id, entrantIds))
    : [];
  const entrantById = new Map(entrantRows.map((e) => [e.id, e]));

  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id !== null))];
  const logoByTeam = teamIds.length ? await getCurrentLogoUrls("team", teamIds, "valorant") : new Map<number, string | null>();
  const mapRows = await db
    .select({ id: maps.id, matchId: maps.matchId, order: maps.order, mapName: maps.mapName, scoreA: maps.teamAScore, scoreB: maps.teamBScore, isCompleted: maps.isCompleted })
    .from(maps)
    .where(inArray(maps.matchId, rows.map((r) => r.id)));

  const matchIds = rows.map((r) => r.id);
  const vetoRows = await db
    .select({ matchId: matchVetos.matchId, entrantId: matchVetos.entrantId, mapName: matchVetos.mapName, type: matchVetos.type, order: matchVetos.order, side: matchVetos.side })
    .from(matchVetos)
    .where(inArray(matchVetos.matchId, matchIds));
  const completedMapRows = mapRows.filter((m) => m.isCompleted);
  const statRows: StatRow[] = completedMapRows.length
    ? (
        await db
          .select({ mapId: mapPlayerStats.mapId, personId: mapPlayerStats.personId, entrantId: mapPlayerStats.entrantId, handle: people.handle, acs: mapPlayerStats.acs, agentName: mapPlayerStats.agentName })
          .from(mapPlayerStats)
          .leftJoin(people, eq(people.id, mapPlayerStats.personId))
          .where(inArray(mapPlayerStats.mapId, completedMapRows.map((m) => m.id)))
      ).map((s) => ({ mapId: s.mapId, entrantId: s.entrantId, key: s.personId != null ? `p${s.personId}` : `e${s.entrantId}:${s.handle ?? "?"}`, personId: s.personId, handle: s.handle ?? "?", acs: s.acs, agentName: s.agentName }))
    : [];
  const mvps = computeMvps(statRows, mapRows);
  // Best player of each team, from the stats of its own entrant.
  const teamMvps = new Map<number, Mvps>();
  for (const entrantId of new Set(statRows.map((r) => r.entrantId).filter((id): id is number => id !== null))) {
    teamMvps.set(entrantId, computeMvps(statRows.filter((r) => r.entrantId === entrantId), mapRows));
  }
  const allMvps = [...mvps.byMap.values(), ...mvps.byMatch.values(), ...[...teamMvps.values()].flatMap((m) => [...m.byMap.values(), ...m.byMatch.values()])];
  const mvpPersonIds = [...new Set(allMvps.map((m) => m.personId).filter((id): id is number => id !== null))];
  const photoByPerson = mvpPersonIds.length ? await getCurrentLogoUrls("person", mvpPersonIds) : new Map<number, string | null>();
  for (const mvp of allMvps) mvp.imageUrl = mvp.personId !== null ? (photoByPerson.get(mvp.personId) ?? null) : null;

  return rows.map((r) => {
    const a = r.entrantAId !== null ? entrantById.get(r.entrantAId) : undefined;
    const b = r.entrantBId !== null ? entrantById.get(r.entrantBId) : undefined;
    return {
      region: r.region,
      official: r.official,
      teamIds: [a?.teamId, b?.teamId].filter((id): id is number => typeof id === "number"),
      match: {
        id: r.id,
        status: r.status,
        nameA: a?.name ?? "TBD",
        nameB: b?.name ?? "TBD",
        shortA: a?.shortName ?? a?.name ?? "TBD",
        shortB: b?.shortName ?? b?.name ?? "TBD",
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        bestOf: r.bestOf,
        tournamentName: r.tournamentName,
        stageName: r.stageName,
        scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
        logoA: a?.teamId != null ? (logoByTeam.get(a.teamId) ?? null) : null,
        logoB: b?.teamId != null ? (logoByTeam.get(b.teamId) ?? null) : null,
        maps: mapRows
          .filter((m) => m.matchId === r.id)
          .map((m) => ({
            ...m,
            mvp: mvps.byMap.get(m.id) ?? null,
            mvpA: (r.entrantAId !== null && teamMvps.get(r.entrantAId)?.byMap.get(m.id)) || null,
            mvpB: (r.entrantBId !== null && teamMvps.get(r.entrantBId)?.byMap.get(m.id)) || null,
          })),
        vetos: vetoRows
          .filter((v) => v.matchId === r.id)
          .map((v) => ({ order: v.order, type: v.type, mapName: v.mapName, by: v.entrantId === r.entrantAId ? ("a" as const) : v.entrantId === r.entrantBId ? ("b" as const) : null, side: v.side === "atk" || v.side === "def" ? v.side : null })),
        mvp: r.status === "completed" ? (mvps.byMatch.get(r.id) ?? null) : null,
        mvpA: r.status === "completed" && r.entrantAId !== null ? (teamMvps.get(r.entrantAId)?.byMatch.get(r.id) ?? null) : null,
        mvpB: r.status === "completed" && r.entrantBId !== null ? (teamMvps.get(r.entrantBId)?.byMatch.get(r.id) ?? null) : null,
      },
    };
  });
}

/** Match shown by the dashboard previews, null when it does not exist (the editor falls back to sample data). */
export async function loadPreviewMatch(): Promise<AlertMatch | null> {
  const id = Number(process.env.GCS_DISCORD_PREVIEW_MATCH_ID) || DEFAULT_PREVIEW_MATCH_ID;
  return (await loadMatchContexts(id))[0]?.match ?? null;
}
