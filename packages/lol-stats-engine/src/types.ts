/**
 * GC-Stats — lol types module
 *
 * Subset of Riot's Match-V5 match and timeline DTOs that the LoL import reads.
 * Only fields the mapper uses are typed; Riot adds fields all the time, and
 * anything extra in the JSON is simply ignored.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** Riot team ids: 100 is the blue side, 200 the red side. */
export type RiotTeamId = 100 | 200;

export interface RiotMatchMetadataDto {
  dataVersion: string;
  matchId: string;
  participants: string[]; // puuids, in participantId order
}

export interface RiotPerkSelectionDto {
  perk: number;
}

export interface RiotPerkStyleDto {
  style: number;
  selections: RiotPerkSelectionDto[];
}

export interface RiotParticipantDto {
  puuid: string;
  participantId: number; // 1–10
  teamId: RiotTeamId;
  teamPosition: string; // TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY | "" when unknown
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  perks: { styles: RiotPerkStyleDto[] };
  summoner1Id: number;
  summoner2Id: number;
  win: boolean;
  gameEndedInSurrender?: boolean;
  gameEndedInEarlySurrender?: boolean;
}

export interface RiotObjectiveDto {
  first: boolean;
  kills: number;
}

export interface RiotTeamDto {
  teamId: RiotTeamId;
  win: boolean;
  bans: { championId: number; pickTurn: number }[];
  objectives: {
    baron: RiotObjectiveDto;
    champion: RiotObjectiveDto;
    dragon: RiotObjectiveDto;
    inhibitor: RiotObjectiveDto;
    riftHerald: RiotObjectiveDto;
    tower: RiotObjectiveDto;
    horde: RiotObjectiveDto; // void grubs
    atakhan?: RiotObjectiveDto;
    [objective: string]: RiotObjectiveDto | undefined;
  };
}

export interface RiotMatchInfoDto {
  gameId: number;
  platformId: string; // e.g. "EUW1"
  gameCreation: number; // epoch ms
  gameDuration: number; // seconds
  gameVersion: string;
  mapId: number;
  queueId: number;
  participants: RiotParticipantDto[];
  teams: RiotTeamDto[];
}

/** Riot Match-V5 `/lol/match/v5/matches/{matchId}` response. */
export interface RiotMatchDto {
  metadata: RiotMatchMetadataDto;
  info: RiotMatchInfoDto;
}

export interface RiotTimelineParticipantDto {
  puuid: string;
  participantId: number;
}

export interface RiotParticipantFrameDto {
  totalGold: number;
  currentGold: number;
  xp: number;
  level: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
  position: { x: number; y: number };
  championStats: Record<string, number>;
  damageStats: Record<string, number>;
}

export interface RiotTimelineEventDto {
  type: string;
  timestamp: number; // ms from game start
  realTimestamp?: number;
  participantId?: number;
  killerId?: number;
  victimId?: number;
  creatorId?: number;
  assistingParticipantIds?: number[];
  teamId?: RiotTeamId;
  killerTeamId?: RiotTeamId;
  position?: { x: number; y: number };
  monsterType?: string;
  monsterSubType?: string;
  buildingType?: string;
  towerType?: string;
  laneType?: string;
  wardType?: string;
  killType?: string;
  transformType?: string;
  itemId?: number;
  skillSlot?: number;
  bounty?: number;
  [field: string]: unknown;
}

export interface RiotTimelineFrameDto {
  timestamp: number;
  participantFrames: Record<string, RiotParticipantFrameDto>; // keyed by participantId "1"–"10"
  events: RiotTimelineEventDto[];
}

/** Riot Match-V5 `/lol/match/v5/matches/{matchId}/timeline` response. */
export interface RiotTimelineDto {
  metadata: RiotMatchMetadataDto;
  info: {
    frameInterval: number;
    gameId: number;
    participants: RiotTimelineParticipantDto[];
    frames: RiotTimelineFrameDto[];
  };
}
