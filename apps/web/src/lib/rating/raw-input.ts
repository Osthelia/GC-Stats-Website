/**
 * GC-Stats - rating input from the RAW layer
 *
 * Rebuilds the source-neutral rating input of stored maps from the RAW
 * tables, so every map can be rated again without refetching Riot.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, inArray, and } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { mapPlayerStats, mapRoundDamagesRaw, mapRoundKillsRaw, mapRoundPlayerLoadoutsRaw, mapRoundPlayerPositionsRaw, mapRoundsRaw } from "@gc-stats/db";
import { agentKey, agentRole, heuristicAttackerForRound, ratingKillCause, type RatingMapInput, type RatingRound, type RiotTeamId } from "@gc-stats/map-stats-engine";

export interface RawRatingMap {
  mapId: number;
  input: RatingMapInput;
  /** Rating input player id (person id as text) to its map_player_stats row id. */
  statRowIdByPlayer: Map<string, number>;
}

/** Ids of every map that has RAW rounds, the only ones that can be rated. */
export async function listRatableMapIds(): Promise<number[]> {
  const rows = await db.selectDistinct({ mapId: mapRoundsRaw.mapId }).from(mapRoundsRaw).orderBy(asc(mapRoundsRaw.mapId));
  return rows.map((r) => r.mapId);
}

function groupByKey<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

export async function loadRawRatingMaps(mapIds: number[]): Promise<RawRatingMap[]> {
  if (mapIds.length === 0) return [];

  const [players, rounds] = await Promise.all([
    db
      .select({ id: mapPlayerStats.id, mapId: mapPlayerStats.mapId, personId: mapPlayerStats.personId, entrantId: mapPlayerStats.entrantId, agentName: mapPlayerStats.agentName })
      .from(mapPlayerStats)
      .where(inArray(mapPlayerStats.mapId, mapIds)),
    db
      .select({
        id: mapRoundsRaw.id,
        mapId: mapRoundsRaw.mapId,
        roundNumber: mapRoundsRaw.roundNumber,
        winningEntrantId: mapRoundsRaw.winningEntrantId,
        atkEntrantId: mapRoundsRaw.atkEntrantId,
        plantTimeMs: mapRoundsRaw.plantTimeMs,
      })
      .from(mapRoundsRaw)
      .where(inArray(mapRoundsRaw.mapId, mapIds))
      .orderBy(asc(mapRoundsRaw.mapId), asc(mapRoundsRaw.roundNumber)),
  ]);

  const roundIds = rounds.map((r) => r.id);
  const [kills, damages, loadouts, objectives] = roundIds.length
    ? await Promise.all([
        db
          .select({
            roundId: mapRoundKillsRaw.mapRoundId,
            killer: mapRoundKillsRaw.killerPersonId,
            victim: mapRoundKillsRaw.victimPersonId,
            timeMs: mapRoundKillsRaw.timeMs,
            assistants: mapRoundKillsRaw.assistantPersonIds,
            damageType: mapRoundKillsRaw.damageType,
          })
          .from(mapRoundKillsRaw)
          .where(inArray(mapRoundKillsRaw.mapRoundId, roundIds)),
        db
          .select({ roundId: mapRoundDamagesRaw.mapRoundId, attacker: mapRoundDamagesRaw.attackerPersonId, receiver: mapRoundDamagesRaw.receiverPersonId, damage: mapRoundDamagesRaw.damage })
          .from(mapRoundDamagesRaw)
          .where(inArray(mapRoundDamagesRaw.mapRoundId, roundIds)),
        db
          .select({ roundId: mapRoundPlayerLoadoutsRaw.mapRoundId, personId: mapRoundPlayerLoadoutsRaw.personId, loadoutValue: mapRoundPlayerLoadoutsRaw.loadoutValue })
          .from(mapRoundPlayerLoadoutsRaw)
          .where(inArray(mapRoundPlayerLoadoutsRaw.mapRoundId, roundIds)),
        db
          .select({ roundId: mapRoundPlayerPositionsRaw.mapRoundId, personId: mapRoundPlayerPositionsRaw.personId, role: mapRoundPlayerPositionsRaw.role })
          .from(mapRoundPlayerPositionsRaw)
          .where(and(inArray(mapRoundPlayerPositionsRaw.mapRoundId, roundIds), inArray(mapRoundPlayerPositionsRaw.role, ["planter", "defuser"]))),
      ])
    : [[], [], [], []];

  const killsByRound = groupByKey(kills, (k) => k.roundId);
  const damagesByRound = groupByKey(damages, (d) => d.roundId);
  const loadoutsByRound = groupByKey(loadouts, (l) => l.roundId);
  const objectivesByRound = groupByKey(objectives, (o) => o.roundId);
  const roundsByMap = groupByKey(rounds, (r) => r.mapId);
  const playersByMap = groupByKey(players, (p) => p.mapId);

  const result: RawRatingMap[] = [];
  for (const mapId of mapIds) {
    const mapPlayers = playersByMap.get(mapId) ?? [];
    const mapRounds = roundsByMap.get(mapId) ?? [];
    if (mapPlayers.length === 0 || mapRounds.length === 0) continue;
    // An unlinked player has no identity in the RAW kills, so the map cannot be rebuilt faithfully: leave it unrated.
    if (mapPlayers.some((p) => p.personId === null)) continue;

    // Team colors are arbitrary here, only "same team or not" matters.
    const entrantIds = [...new Set(mapPlayers.map((p) => p.entrantId))].sort((a, b) => a - b);
    if (entrantIds.length !== 2) continue;
    const teamOf = (entrantId: number | null): RiotTeamId | null => (entrantId === entrantIds[0] ? "Red" : entrantId === entrantIds[1] ? "Blue" : null);

    const statRowIdByPlayer = new Map<string, number>();
    const input: RatingMapInput = {
      players: mapPlayers.map((p) => {
        statRowIdByPlayer.set(String(p.personId), p.id);
        return { id: String(p.personId), team: teamOf(p.entrantId)!, agent: agentKey(p.agentName), role: agentRole(p.agentName) };
      }),
      rounds: [],
    };

    const teamByPlayer = new Map(input.players.map((p) => [p.id, p.team]));
    const planterTeam = (roundId: number) => {
      const planter = objectivesByRound.get(roundId)?.find((o) => o.role === "planter");
      return planter ? (teamByPlayer.get(String(planter.personId)) ?? null) : null;
    };
    // Older imported maps have no stored sides: infer them from any round with a known attacker (stored, or the planter's team).
    let firstHalfAttacker: RiotTeamId | null = null;
    for (const round of mapRounds) {
      const knownAtk = teamOf(round.atkEntrantId) ?? planterTeam(round.id);
      if (!knownAtk) continue;
      firstHalfAttacker = heuristicAttackerForRound(round.roundNumber, "Red") === knownAtk ? "Red" : "Blue";
      break;
    }

    for (const round of mapRounds) {
      const atkTeam = teamOf(round.atkEntrantId) ?? (firstHalfAttacker ? heuristicAttackerForRound(round.roundNumber, firstHalfAttacker) : null);
      const winnerTeam = teamOf(round.winningEntrantId);
      if (!atkTeam || !winnerTeam) continue;
      const objectivesOfRound = objectivesByRound.get(round.id) ?? [];
      const ratingRound: RatingRound = {
        roundNum: round.roundNumber,
        atkTeam,
        winnerTeam,
        plantTimeMs: round.plantTimeMs,
        planter: idOrNull(objectivesOfRound.find((o) => o.role === "planter")?.personId),
        defuser: idOrNull(objectivesOfRound.find((o) => o.role === "defuser")?.personId),
        loadouts: Object.fromEntries((loadoutsByRound.get(round.id) ?? []).map((l) => [String(l.personId), l.loadoutValue ?? 0])),
        kills: (killsByRound.get(round.id) ?? []).map((k) => ({
          timeMs: k.timeMs,
          cause: ratingKillCause(idOrNull(k.killer), k.damageType),
          killer: idOrNull(k.killer),
          victim: String(k.victim),
          assistants: (k.assistants ?? []).map(String),
        })),
        damages: (damagesByRound.get(round.id) ?? []).filter((d) => d.attacker !== null).map((d) => ({ attacker: String(d.attacker), receiver: String(d.receiver), damage: d.damage })),
      };
      input.rounds.push(ratingRound);
    }

    if (input.rounds.length > 0) result.push({ mapId, input, statRowIdByPlayer });
  }
  return result;
}

function idOrNull(id: number | null | undefined): string | null {
  return id == null ? null : String(id);
}
