/**
 * GC-Stats — validate-import module
 *
 * Checks the match and timeline JSON of an admin upload before anything is written. Upload data is
 * untyped, so this narrows it to the Match-V5 types the mappers take, or lists every problem found.
 * Pure, no I/O.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotMatchDto, RiotTimelineDto } from "./types";

export type ImportValidation = { ok: true; match: RiotMatchDto; timeline: RiotTimelineDto | null } | { ok: false; errors: string[] };

type Json = Record<string, unknown>;

/** `timeline` is null when the game has none (chronobreak). Pass undefined and it is rejected, so a missing file is never mistaken for that. */
export function validateImport(match: unknown, timeline: unknown): ImportValidation {
  if (!isRecord(match) || !isRecord(match.metadata) || !isRecord(match.info)) {
    return { ok: false, errors: ["match is not a Match-V5 match (metadata and info are required)"] };
  }

  const errors: string[] = [];
  const matchId = match.metadata.matchId;
  const info = match.info;
  const participants = Array.isArray(info.participants) ? info.participants : [];

  if (typeof matchId !== "string") errors.push("match.metadata.matchId is missing");
  if (match.metadata.dataVersion !== "2") errors.push(`match.metadata.dataVersion is ${JSON.stringify(match.metadata.dataVersion)}, expected "2" (Match-V5)`);
  if (participants.length !== 10) errors.push(`match.info.participants has ${participants.length} entries, expected 10`);
  if (!participants.every(isParticipant)) errors.push("a participant is missing puuid, participantId or a valid teamId (100 or 200)");
  if (new Set(participants.map((p) => (isRecord(p) ? p.participantId : undefined))).size !== participants.length) {
    errors.push("match.info.participants have duplicate participantId values");
  }
  if (!Array.isArray(info.teams) || info.teams.length !== 2) errors.push("match.info.teams must have 2 entries");
  if (typeof info.platformId !== "string") errors.push("match.info.platformId is missing");
  if (typeof info.gameCreation !== "number") errors.push("match.info.gameCreation is missing");
  if (typeof info.gameDuration !== "number") errors.push("match.info.gameDuration is missing");

  if (timeline !== null) {
    if (!isRecord(timeline) || !isRecord(timeline.metadata) || !isRecord(timeline.info)) {
      errors.push("timeline is not a Match-V5 timeline (metadata and info are required)");
    } else {
      if (timeline.metadata.matchId !== matchId) {
        errors.push(`timeline is for ${JSON.stringify(timeline.metadata.matchId)}, the match is ${JSON.stringify(matchId)}`);
      }
      if (!Array.isArray(timeline.info.frames)) errors.push("timeline.info.frames is missing");
      if (typeof timeline.info.frameInterval !== "number") errors.push("timeline.info.frameInterval is missing");
      if (!sameParticipants(participants, timeline.info.participants)) {
        errors.push("timeline participants are not the same ten puuids as the match");
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, match: match as unknown as RiotMatchDto, timeline: timeline as RiotTimelineDto | null };
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isParticipant(value: unknown): boolean {
  return isRecord(value) && typeof value.puuid === "string" && typeof value.participantId === "number" && (value.teamId === 100 || value.teamId === 200);
}

function sameParticipants(matchParticipants: unknown[], timelineParticipants: unknown): boolean {
  if (!Array.isArray(timelineParticipants)) return false;
  const matchPuuids = new Set(matchParticipants.map((p) => (isRecord(p) ? p.puuid : undefined)));
  const timelinePuuids = timelineParticipants.map((p) => (isRecord(p) ? p.puuid : undefined));
  return timelinePuuids.length === matchPuuids.size && timelinePuuids.every((puuid) => matchPuuids.has(puuid));
}
