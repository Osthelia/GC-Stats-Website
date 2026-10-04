/**
 * GC-Stats - raw-mapper
 *
 * Builds the RAW-layer DB rows (rounds, kills, damages, alive states,
 * positions, loadouts) from a Riot match DTO, ready for insertion by
 * store-map-data.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { computeRoundSides, extractPlantInfo, normalizeRoundKills, type RiotMatchDto, type RiotTeamId } from "@gc-stats/map-stats-engine";
import type { mapRoundAliveStatesRaw, mapRoundDamagesRaw, mapRoundKillsRaw, mapRoundPlayerLoadoutsRaw, mapRoundPlayerPositionsRaw, mapRoundsRaw } from "@gc-stats/db";
import { resolveEquipName, type RiotContent } from "@/lib/riot-content-client";

export interface RawMapperContext {
  mapId: number;
  entrantAId: number;
  entrantBId: number;
  /** Which Riot color entrant A played as this map. */
  teamAColor: RiotTeamId;
  personIdByPuuid: Map<string, number>;
  content: RiotContent;
}

export function entrantIdForColor(ctx: RawMapperContext, color: RiotTeamId): number {
  return color === ctx.teamAColor ? ctx.entrantAId : ctx.entrantBId;
}

/** Riot's `roundResultCode` -> its `roundResult` label, for responses missing the latter. */
const WIN_TYPE_BY_CODE: Record<string, string> = {
  elimination: "Eliminated",
  defuse: "Bomb defused",
  detonate: "Bomb detonated",
  surrendered: "Surrendered",
};

/** Stores Riot's own `roundResult` label ("Eliminated", "Bomb defused", ...) like V1 did (GameMapController: 'win_type' => $round['roundResult']). */
function mapWinType(roundResult: string | undefined, roundResultCode: string | undefined): string {
  const label = roundResult?.trim();
  if (label) return label;
  const code = (roundResultCode ?? "").trim().toLowerCase();
  if (!code) return "Round timer expired";
  return WIN_TYPE_BY_CODE[code] ?? roundResultCode!.trim();
}

function resolveKillWeaponDisplay(damageType: string, weaponOrAbility: string, content: RiotContent): string | null {
  if (damageType === "Weapon" || damageType === "Melee") return resolveEquipName(content, weaponOrAbility) || null;
  // No ability-name resolution built yet (see SUIVI.md — agents:sync-abilities
  // deferred, no kill-feed to feed): store Riot's own literal (Ability1/
  // Ability2/GrenadeAbility/Ultimate) rather than nothing.
  if (damageType === "Ability") return weaponOrAbility || null;
  return null; // Bomb / Fall — no meaningful weapon
}

type NewRoundRow = typeof mapRoundsRaw.$inferInsert;
type NewKillRow = typeof mapRoundKillsRaw.$inferInsert;
type NewDamageRow = typeof mapRoundDamagesRaw.$inferInsert;
type NewAliveStateRow = typeof mapRoundAliveStatesRaw.$inferInsert;
type NewPositionRow = typeof mapRoundPlayerPositionsRaw.$inferInsert;
type NewLoadoutRow = typeof mapRoundPlayerLoadoutsRaw.$inferInsert;

export function buildRoundRows(match: RiotMatchDto, ctx: RawMapperContext): NewRoundRow[] {
  const sidesByRound = computeRoundSides(match.roundResults, match.players);
  return match.roundResults.map((round) => {
    const sides = sidesByRound.get(round.roundNum)!;
    const plant = extractPlantInfo(round);
    return {
      mapId: ctx.mapId,
      roundNumber: round.roundNum,
      winningEntrantId: entrantIdForColor(ctx, round.winningTeam),
      winType: mapWinType(round.roundResult, round.roundResultCode),
      atkEntrantId: entrantIdForColor(ctx, sides.atk),
      defEntrantId: entrantIdForColor(ctx, sides.def),
      plantSite: plant.plantSite,
      plantX: plant.plantX,
      plantY: plant.plantY,
      plantTimeMs: plant.plantTimeMs,
    };
  });
}

export interface KillWithPositions {
  killRow: NewKillRow;
  /** `mapRoundKillId` intentionally left unset — patched in by the caller once the kill row's real id comes back from the insert. */
  positionRows: NewPositionRow[];
}

/** One entry per kill in the match, each paired with the position rows (killer/victim/bystanders) that reference it. Requires every round already inserted (`roundIdByRoundNumber`). */
export function buildKillRows(match: RiotMatchDto, ctx: RawMapperContext, roundIdByRoundNumber: Map<number, number>): KillWithPositions[] {
  const results: KillWithPositions[] = [];

  for (const round of match.roundResults) {
    const mapRoundId = roundIdByRoundNumber.get(round.roundNum);
    if (mapRoundId === undefined) continue;

    for (const kill of normalizeRoundKills(round)) {
      const victimPersonId = ctx.personIdByPuuid.get(kill.victimPuuid);
      if (victimPersonId === undefined) continue; // guarded upstream — every player must be resolved before ingestion

      const killerPersonId = kill.killerPuuid ? (ctx.personIdByPuuid.get(kill.killerPuuid) ?? null) : null;
      const assistantPersonIds = kill.assistantPuuids.map((p) => ctx.personIdByPuuid.get(p)).filter((id): id is number => id !== undefined);

      const killRow: NewKillRow = {
        mapRoundId,
        killerPersonId,
        victimPersonId,
        timeMs: kill.timeSinceRoundStartMillis,
        weapon: resolveKillWeaponDisplay(kill.damageType, kill.weaponOrAbility, ctx.content),
        damageType: kill.damageType,
        isSecondaryFire: kill.isSecondaryFire,
        assistantPersonIds: assistantPersonIds.length ? assistantPersonIds : null,
      };

      const positionRows: NewPositionRow[] = [];
      // Riot never includes the victim's own location in `playerLocations`
      // (confirmed on RiotMatchExample.json: 0/144 kills) — it's given
      // separately as `victimLocation`, with no view angle for an already-dead player.
      const victimPersonIdForPosition = ctx.personIdByPuuid.get(kill.victimPuuid);
      if (kill.victimLocation && victimPersonIdForPosition !== undefined) {
        positionRows.push({
          mapId: ctx.mapId,
          mapRoundId,
          eventType: "kill",
          personId: victimPersonIdForPosition,
          role: "victim",
          x: kill.victimLocation.x,
          y: kill.victimLocation.y,
          viewRadians: null,
          timeMs: kill.timeSinceRoundStartMillis,
        });
      }
      for (const loc of kill.playerLocations) {
        const personId = ctx.personIdByPuuid.get(loc.puuid);
        if (personId === undefined) continue;
        const role = loc.puuid === kill.killerPuuid ? "killer" : "bystander";
        positionRows.push({
          mapId: ctx.mapId,
          mapRoundId,
          eventType: "kill",
          personId,
          role,
          x: loc.location.x,
          y: loc.location.y,
          viewRadians: loc.viewRadians,
          timeMs: kill.timeSinceRoundStartMillis,
        });
      }

      results.push({ killRow, positionRows });
    }
  }

  return results;
}

export function buildDamageRows(match: RiotMatchDto, ctx: RawMapperContext, roundIdByRoundNumber: Map<number, number>): NewDamageRow[] {
  const rows: NewDamageRow[] = [];
  for (const round of match.roundResults) {
    const mapRoundId = roundIdByRoundNumber.get(round.roundNum);
    if (mapRoundId === undefined) continue;

    for (const playerStats of round.playerStats) {
      const attackerPersonId = ctx.personIdByPuuid.get(playerStats.puuid) ?? null;
      for (const damage of playerStats.damage) {
        const receiverPersonId = ctx.personIdByPuuid.get(damage.receiver);
        if (receiverPersonId === undefined) continue;
        rows.push({
          mapRoundId,
          attackerPersonId,
          receiverPersonId,
          damage: damage.damage,
          headshots: damage.headshots,
          bodyshots: damage.bodyshots,
          legshots: damage.legshots,
        });
      }
    }
  }
  return rows;
}

export function buildAliveStateRows(aliveStateRows: { roundNum: number; sequence: number; timeMs: number; atkAlive: number; defAlive: number; winnerSide: "atk" | "def" }[], roundIdByRoundNumber: Map<number, number>): NewAliveStateRow[] {
  const rows: NewAliveStateRow[] = [];
  for (const row of aliveStateRows) {
    const mapRoundId = roundIdByRoundNumber.get(row.roundNum);
    if (mapRoundId === undefined) continue;
    rows.push({ mapRoundId, sequence: row.sequence, timeMs: row.timeMs, atkAlive: row.atkAlive, defAlive: row.defAlive, winnerSide: row.winnerSide });
  }
  return rows;
}

export function buildPlantDefusePositionRows(match: RiotMatchDto, ctx: RawMapperContext, roundIdByRoundNumber: Map<number, number>): NewPositionRow[] {
  const rows: NewPositionRow[] = [];
  for (const round of match.roundResults) {
    const mapRoundId = roundIdByRoundNumber.get(round.roundNum);
    if (mapRoundId === undefined) continue;

    for (const loc of round.plantPlayerLocations ?? []) {
      const personId = ctx.personIdByPuuid.get(loc.puuid);
      if (personId === undefined) continue;
      rows.push({
        mapId: ctx.mapId,
        mapRoundId,
        eventType: "plant",
        personId,
        role: loc.puuid === round.bombPlanter ? "planter" : "bystander",
        x: loc.location.x,
        y: loc.location.y,
        viewRadians: loc.viewRadians,
        timeMs: round.plantRoundTime,
      });
    }

    for (const loc of round.defusePlayerLocations ?? []) {
      const personId = ctx.personIdByPuuid.get(loc.puuid);
      if (personId === undefined) continue;
      rows.push({
        mapId: ctx.mapId,
        mapRoundId,
        eventType: "defuse",
        personId,
        role: loc.puuid === round.bombDefuser ? "defuser" : "bystander",
        x: loc.location.x,
        y: loc.location.y,
        viewRadians: loc.viewRadians,
        timeMs: round.defuseRoundTime,
      });
    }
  }
  return rows;
}

export function buildLoadoutRows(match: RiotMatchDto, ctx: RawMapperContext, roundIdByRoundNumber: Map<number, number>): NewLoadoutRow[] {
  const rows: NewLoadoutRow[] = [];
  for (const round of match.roundResults) {
    const mapRoundId = roundIdByRoundNumber.get(round.roundNum);
    if (mapRoundId === undefined) continue;

    const roundKills = normalizeRoundKills(round);

    for (const playerStats of round.playerStats) {
      const personId = ctx.personIdByPuuid.get(playerStats.puuid);
      if (personId === undefined) continue;
      const player = match.players.find((p) => p.puuid === playerStats.puuid);
      const entrantId = player ? entrantIdForColor(ctx, player.teamId) : null;

      rows.push({
        mapRoundId,
        personId,
        entrantId,
        kills: roundKills.filter((k) => k.killerPuuid === playerStats.puuid).length,
        assists: roundKills.filter((k) => k.assistantPuuids.includes(playerStats.puuid)).length,
        score: playerStats.score,
        loadoutValue: playerStats.economy?.loadoutValue ?? null,
        economySpent: playerStats.economy?.spent ?? null,
        economyRemaining: playerStats.economy?.remaining ?? null,
        weapon: playerStats.economy?.weapon ? resolveEquipName(ctx.content, playerStats.economy.weapon) : null,
        armor: playerStats.economy?.armor ? resolveEquipName(ctx.content, playerStats.economy.armor) : null,
      });
    }
  }
  return rows;
}
