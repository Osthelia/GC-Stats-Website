/**
 * GC-Stats - store-map-data
 *
 * Writes everything a successful map fetch produces: replaces the RAW and
 * aggregated layers wholesale (idempotent re-fetch) and updates the map's
 * summary columns, all in one transaction guarded by an advisory lock on the
 * map id so concurrent fetches of the same map never interleave.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { maps, mapRoundsRaw, mapRoundKillsRaw, mapRoundDamagesRaw, mapRoundAliveStatesRaw, mapRoundPlayerPositionsRaw, mapRoundPlayerLoadoutsRaw, mapPlayerStats, mapTeamRoundSummary } from "@gc-stats/db";
import { computeAliveTimeline, computeMapAggregates, computeRoundSides, type RiotMatchDto } from "@gc-stats/map-stats-engine";
import { resolveAgentName, resolveEquipName, resolveMapName } from "@/lib/riot-content-client";
import { buildAliveStateRows, buildDamageRows, buildKillRows, buildLoadoutRows, buildPlantDefusePositionRows, buildRoundRows, entrantIdForColor, type RawMapperContext } from "./raw-mapper";

/**
 * Writes everything a successful fetch produces for one map: replaces the
 * RAW layer and the aggregated layer wholesale (a re-fetch is a full
 * replacement, not a merge — idempotent), then updates the map's own
 * summary columns. One transaction: either all of it lands, or none of it.
 * An advisory lock on the map id serializes concurrent fetches of the same
 * map (two admin tabs, or a double click), so the delete + insert pair below
 * never interleaves across two transactions.
 */
export async function storeMapData(match: RiotMatchDto, ctx: RawMapperContext): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ctx.mapId})`);

    // Idempotent re-fetch: clear this map's previous RAW + aggregated rows first.
    await tx.delete(mapRoundsRaw).where(eq(mapRoundsRaw.mapId, ctx.mapId)); // cascades kills/damages/alive-states/loadouts and (via mapRoundId) positions
    await tx.delete(mapPlayerStats).where(eq(mapPlayerStats.mapId, ctx.mapId));
    await tx.delete(mapTeamRoundSummary).where(eq(mapTeamRoundSummary.mapId, ctx.mapId));

    const roundRows = buildRoundRows(match, ctx);
    const insertedRounds = roundRows.length
      ? await tx.insert(mapRoundsRaw).values(roundRows).returning({ id: mapRoundsRaw.id, roundNumber: mapRoundsRaw.roundNumber })
      : [];
    const roundIdByRoundNumber = new Map(insertedRounds.map((r) => [r.roundNumber, r.id]));

    const killsWithPositions = buildKillRows(match, ctx, roundIdByRoundNumber);
    const insertedKills = killsWithPositions.length
      ? await tx
          .insert(mapRoundKillsRaw)
          .values(killsWithPositions.map((k) => k.killRow))
          .returning({ id: mapRoundKillsRaw.id })
      : [];
    // A single multi-row INSERT ... RETURNING preserves the VALUES order in Postgres.
    const killPositions = killsWithPositions.flatMap((k, index) => k.positionRows.map((p) => ({ ...p, mapRoundKillId: insertedKills[index]?.id ?? null })));

    const damageRows = buildDamageRows(match, ctx, roundIdByRoundNumber);
    if (damageRows.length) await tx.insert(mapRoundDamagesRaw).values(damageRows);

    const sidesByRound = computeRoundSides(match.roundResults, match.players);
    const aliveStateRows = buildAliveStateRows(computeAliveTimeline(match, sidesByRound), roundIdByRoundNumber);
    if (aliveStateRows.length) await tx.insert(mapRoundAliveStatesRaw).values(aliveStateRows);

    const plantDefusePositions = buildPlantDefusePositionRows(match, ctx, roundIdByRoundNumber);
    const allPositions = [...killPositions, ...plantDefusePositions];
    if (allPositions.length) await tx.insert(mapRoundPlayerPositionsRaw).values(allPositions);

    const loadoutRows = buildLoadoutRows(match, ctx, roundIdByRoundNumber);
    if (loadoutRows.length) await tx.insert(mapRoundPlayerLoadoutsRaw).values(loadoutRows);

    const aggregates = computeMapAggregates(match, (uuid) => resolveEquipName(ctx.content, uuid));
    const playerStatRows = aggregates.playerStats.map((row) => ({
      mapId: ctx.mapId,
      personId: ctx.personIdByPuuid.get(row.puuid) ?? null,
      entrantId: entrantIdForColor(ctx, row.teamId),
      agentName: resolveAgentName(ctx.content, row.agentCharacterId),
      valName: row.valName,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      acs: row.acs,
      adr: row.adr,
      kastPercentage: String(row.kastPercentage),
      firstKills: row.firstKills,
      firstDeaths: row.firstDeaths,
      headshotPercentage: String(row.headshotPercentage),
      clutches: row.clutches,
      multikills: row.multikills,
      tradeKills: row.tradeKills,
      tradedDeaths: row.tradedDeaths,
      roundTypeSplits: row.roundTypeSplits,
      abilityKills: row.abilityKills,
      fallDeaths: row.fallDeaths,
      weaponKills: row.weaponKills,
    }));
    if (playerStatRows.length) await tx.insert(mapPlayerStats).values(playerStatRows);

    const teamRoundRows = aggregates.teamRoundSummary.map((row) => ({
      mapId: ctx.mapId,
      entrantId: entrantIdForColor(ctx, row.teamId),
      side: row.side,
      roundsPlayed: row.roundsPlayed,
      roundsWon: row.roundsWon,
    }));
    if (teamRoundRows.length) await tx.insert(mapTeamRoundSummary).values(teamRoundRows);

    const teamAEntry = match.teams.find((t) => t.teamId === ctx.teamAColor);
    const teamBEntry = match.teams.find((t) => t.teamId !== ctx.teamAColor);

    await tx
      .update(maps)
      .set({
        apiMatchId: match.matchInfo.matchId,
        mapName: resolveMapName(ctx.content, match.matchInfo.mapId),
        gameMode: match.matchInfo.gameMode ?? null,
        teamAScore: teamAEntry?.roundsWon ?? null,
        teamBScore: teamBEntry?.roundsWon ?? null,
        isCompleted: match.matchInfo.isCompleted,
        isForfeit: false, // real fetched data is never a forfeit
        startedAt: new Date(match.matchInfo.gameStartMillis),
      })
      .where(eq(maps.id, ctx.mapId));
  });
}
