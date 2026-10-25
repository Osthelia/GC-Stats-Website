/**
 * GC-Stats — lol timeline-rows module
 *
 * Pure mapping from a Match-V5 timeline to the raw rows of a LoL game:
 * one frame row per player per frame, and one event row per timeline event
 * in Riot's order. Riot's participant ids are mapped to people by the caller,
 * so every row points at `people`, not at a per-game index. A participant
 * that has no person throws, because a partial import would leave gaps.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sideForTeamId, type LeagueSide } from "./game-summary";
import type { RiotTimelineDto, RiotTimelineEventDto, RiotTimelineFrameDto } from "./types";

export interface LeagueFrameRow {
  gameId: number;
  personId: number;
  frame: number; // index of the frame in Riot's list, about one per minute
  timeMs: number;
  totalGold: number;
  currentGold: number;
  xp: number;
  level: number;
  cs: number;
  jungleCs: number;
  x: number;
  y: number;
  championStats: Record<string, number>;
  damageStats: Record<string, number>;
}

export interface LeagueEventRow {
  gameId: number;
  seq: number; // Riot's order of events within the game
  timeMs: number;
  type: string;
  personId: number | null; // actor, null for minions, towers and monsters
  targetPersonId: number | null; // victimId
  assistantPersonIds: number[] | null;
  side: LeagueSide | null;
  x: number | null;
  y: number | null;
  subtype: string | null;
  lane: string | null;
  itemId: number | null;
  skillSlot: number | null;
  bounty: number | null;
  data: Record<string, unknown>;
}

export interface LeagueTimelineRows {
  frames: LeagueFrameRow[];
  events: LeagueEventRow[];
}

export interface LeagueTimelineContext {
  gameId: number;
  /** Person id for each Riot participant id (1–10). Must cover all ten participants. */
  personIdByParticipantId: Map<number, number>;
  /** Side for each Riot participant id, used for events that carry no team id. */
  sideByParticipantId: Map<number, LeagueSide>;
}

/** Event fields that become their own columns. Everything else stays in `data`. */
const COLUMN_FIELDS = new Set([
  "type",
  "timestamp",
  "participantId",
  "killerId",
  "creatorId",
  "victimId",
  "assistingParticipantIds",
  "teamId",
  "killerTeamId",
  "position",
  "monsterType",
  "monsterSubType",
  "buildingType",
  "towerType",
  "laneType",
  "wardType",
  "killType",
  "transformType",
  "itemId",
  "skillSlot",
  "bounty",
  "name",
]);

/** `null` timeline (chronobreak, or not exported) gives no rows. */
export function buildTimelineRows(timeline: RiotTimelineDto | null, ctx: LeagueTimelineContext): LeagueTimelineRows {
  if (!timeline) return { frames: [], events: [] };
  const frames = timeline.info.frames.flatMap((frame, index) => buildFrameRows(frame, index, ctx));
  const events = timeline.info.frames
    .flatMap((frame) => frame.events)
    .map((event, seq) => buildEventRow(event, seq, ctx));
  return { frames, events };
}

function buildFrameRows(frame: RiotTimelineFrameDto, index: number, ctx: LeagueTimelineContext): LeagueFrameRow[] {
  return Object.entries(frame.participantFrames).map(([participantKey, pf]) => ({
    gameId: ctx.gameId,
    personId: personFor(Number(participantKey), ctx),
    frame: index,
    timeMs: frame.timestamp,
    totalGold: pf.totalGold,
    currentGold: pf.currentGold,
    xp: pf.xp,
    level: pf.level,
    cs: pf.minionsKilled,
    jungleCs: pf.jungleMinionsKilled,
    x: pf.position.x,
    y: pf.position.y,
    championStats: pf.championStats,
    damageStats: pf.damageStats,
  }));
}

function buildEventRow(event: RiotTimelineEventDto, seq: number, ctx: LeagueTimelineContext): LeagueEventRow {
  // The actor field differs per type. Riot uses 0 for "no killer" (minion, tower, monster).
  const actorId = nonZero(event.participantId ?? event.killerId ?? event.creatorId);
  const victimId = nonZero(event.victimId);

  return {
    gameId: ctx.gameId,
    seq,
    timeMs: event.timestamp,
    type: event.type,
    personId: actorId === null ? null : personFor(actorId, ctx),
    targetPersonId: victimId === null ? null : personFor(victimId, ctx),
    assistantPersonIds: event.assistingParticipantIds ? event.assistingParticipantIds.map((id) => personFor(id, ctx)) : null,
    side: eventSide(event, actorId, ctx),
    x: event.position?.x ?? null,
    y: event.position?.y ?? null,
    subtype: subtypeOf(event),
    lane: event.laneType ?? null,
    itemId: event.itemId ?? null,
    skillSlot: event.skillSlot ?? null,
    bounty: event.bounty ?? null,
    data: restOf(event),
  };
}

/** The team named by the event, or else the actor's team. */
function eventSide(event: RiotTimelineEventDto, actorId: number | null, ctx: LeagueTimelineContext): LeagueSide | null {
  const teamId = event.teamId ?? event.killerTeamId;
  if (teamId !== undefined) return sideForTeamId(teamId);
  return actorId === null ? null : (ctx.sideByParticipantId.get(actorId) ?? null);
}

/** The part of each event that does not fit a column. Keeps the kill damage arrays, feats, undo states… */
function restOf(event: RiotTimelineEventDto): Record<string, unknown> {
  return Object.fromEntries(Object.entries(event).filter(([key]) => !COLUMN_FIELDS.has(key)));
}

function subtypeOf(event: RiotTimelineEventDto): string | null {
  switch (event.type) {
    case "ELITE_MONSTER_KILL":
      return [event.monsterType, event.monsterSubType].filter(Boolean).join(":") || null;
    case "BUILDING_KILL":
      return event.towerType ?? event.buildingType ?? null;
    case "WARD_PLACED":
    case "WARD_KILL":
      return event.wardType ?? null;
    case "CHAMPION_SPECIAL_KILL":
      return event.killType ?? null;
    case "CHAMPION_TRANSFORM":
      return event.transformType ?? null;
    case "DRAGON_SOUL_GIVEN":
      return event.name ?? null;
    default:
      return null;
  }
}

function personFor(participantId: number, ctx: LeagueTimelineContext): number {
  const personId = ctx.personIdByParticipantId.get(participantId);
  if (personId === undefined) throw new Error(`Riot participant ${participantId} has no person; map every participant before importing the timeline`);
  return personId;
}

function nonZero(id: number | undefined): number | null {
  return id === undefined || id === 0 ? null : id;
}
