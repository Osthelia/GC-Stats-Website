/**
 * GC-Stats — Type definitions: types
 *
 * DTOs for the Riot VALORANT match-v1 API, as relayed verbatim by
 * RiotRelay (it never transforms the body on GET/renew, only on merge, and
 * even then only matchInfo/players/teams/roundResults, in the same shape).
 * Field names/casing mirror Riot's own API exactly.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type RiotTeamId = "Red" | "Blue";

export interface RiotMatchInfoDto {
  matchId: string;
  mapId: string; // asset path, e.g. "/Game/Maps/Ascent/Ascent" — NOT a UUID
  gameVersion?: string;
  gameLengthMillis?: number;
  region?: string;
  gameStartMillis: number;
  provisioningFlowId?: string;
  isCompleted: boolean;
  customGameName?: string;
  queueId?: string;
  gameMode?: string;
  isRanked?: boolean;
  seasonId?: string;
}

export interface RiotAbilityCastsDto {
  grenadeCasts: number;
  ability1Casts: number;
  ability2Casts: number;
  ultimateCasts: number;
}

export interface RiotPlayerStatsDto {
  score: number;
  roundsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  playtimeMillis: number;
  abilityCasts?: RiotAbilityCastsDto | null;
}

export interface RiotMatchPlayerDto {
  puuid: string;
  gameName: string;
  tagLine: string;
  teamId: RiotTeamId;
  partyId?: string;
  characterId: string; // agent UUID
  stats: RiotPlayerStatsDto;
  competitiveTier?: number;
  isObserver: boolean;
  playerCard?: string;
  playerTitle?: string;
  accountLevel?: number;
}

export interface RiotTeamDto {
  teamId: RiotTeamId;
  won: boolean;
  roundsPlayed: number;
  roundsWon: number;
  numPoints?: number;
}

export interface RiotLocationDto {
  x: number;
  y: number;
}

export interface RiotPlayerLocationDto {
  puuid: string;
  viewRadians: number;
  location: RiotLocationDto;
}

export interface RiotFinishingDamageDto {
  // "Weapon" | "Ability" | "Bomb" | "Melee" | "Fall" in practice.
  damageType: string;
  // UUID for Weapon/Melee, literal "Ability1"/"Ability2"/"GrenadeAbility"/
  // "Ultimate" for Ability, empty/irrelevant for Bomb/Fall.
  damageItem: string;
  isSecondaryFireMode: boolean;
}

export interface RiotKillDto {
  timeSinceGameStartMillis: number;
  timeSinceRoundStartMillis: number;
  killer: string; // puuid, "" for an environmental/self death
  victim: string;
  victimLocation: RiotLocationDto | null;
  assistants: string[];
  playerLocations: RiotPlayerLocationDto[];
  finishingDamage: RiotFinishingDamageDto;
}

export interface RiotDamageDto {
  receiver: string;
  damage: number;
  legshots: number;
  bodyshots: number;
  headshots: number;
}

export interface RiotEconomyDto {
  loadoutValue: number;
  weapon: string; // UUID, or "" if unarmed
  armor: string; // UUID, or "" if no armor
  remaining: number;
  spent: number;
}

export interface RiotRoundPlayerStatsDto {
  puuid: string;
  kills: RiotKillDto[]; // kills made BY this player this round (not a shared/deduped list)
  damage: RiotDamageDto[]; // damage dealt BY this player this round
  score: number;
  economy: RiotEconomyDto;
}

export interface RiotRoundResultDto {
  roundNum: number; // 0-indexed
  roundResult: string; // "Eliminated" | "Bomb defused" | "Surrendered" | ...
  roundCeremony?: string;
  winningTeam: RiotTeamId;
  // Present on real match-v1 responses — the authoritative source for
  // ATK/DEF per round. Treated as possibly absent (older/edge-case data)
  // with a first-half/swap/OT-alternation fallback, see sides.ts.
  winningTeamRole?: "Attacker" | "Defender" | string | null;
  bombPlanter: string | null;
  bombDefuser: string | null;
  plantRoundTime: number;
  plantPlayerLocations?: RiotPlayerLocationDto[] | null;
  plantLocation?: RiotLocationDto | null;
  plantSite: string | null;
  defuseRoundTime: number;
  defusePlayerLocations?: RiotPlayerLocationDto[] | null;
  defuseLocation?: RiotLocationDto | null;
  roundResultCode: string; // "Elimination" | "Defuse" | "Detonate" | "Surrendered" | ...
  playerStats: RiotRoundPlayerStatsDto[];
}

export interface RiotMatchDto {
  matchInfo: RiotMatchInfoDto;
  players: RiotMatchPlayerDto[];
  coaches?: unknown[];
  teams: RiotTeamDto[];
  roundResults: RiotRoundResultDto[];
}

// --- Aggregation output ------------------------------------------------

export interface ClutchEntry {
  won: number;
  total: number;
}

export interface RoundTypeSplitBuy {
  won: number;
  played: number;
}

export interface RoundTypeSplitSide {
  rounds: number;
  roundsWon: number;
  kills: number;
  /** Raw count of rounds on this side with a KAST credit (not a percentage — summable across maps). */
  kast: number;
}

export interface AbilityKills {
  ability1: number;
  ability2: number;
  grenade: number;
  ultimate: number;
}

export interface PlayerAggRow {
  puuid: string;
  teamId: RiotTeamId;
  /** "<gameName>#<tagLine>" — Riot ID, not a resolved GC-Stats identity. */
  valName: string;
  /** Raw Riot agent UUID — resolved to a display name by the I/O layer (apps/web), which has the content client. */
  agentCharacterId: string;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kastPercentage: number;
  firstKills: number;
  firstDeaths: number;
  headshotPercentage: number;
  clutches: Record<string, ClutchEntry>; // "1v1".."1v5"
  multikills: Record<string, number>; // "2k".."5k"
  tradeKills: number;
  tradedDeaths: number;
  roundTypeSplits: Record<string, RoundTypeSplitBuy | RoundTypeSplitSide>; // "pistol"|"eco"|"force"|"fullBuy"|"atk"|"def"
  abilityKills: AbilityKills;
  fallDeaths: number;
  weaponKills: Record<string, number>; // keyed by already-resolved display name
}

export interface TeamRoundAggRow {
  teamId: RiotTeamId;
  side: "atk" | "def";
  roundsPlayed: number;
  roundsWon: number;
}

export interface MapAggregates {
  playerStats: PlayerAggRow[];
  teamRoundSummary: TeamRoundAggRow[];
}
