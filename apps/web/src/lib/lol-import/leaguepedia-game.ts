/**
 * GC-Stats - leaguepedia-game
 *
 * The match and timeline of one game, from the bucket or from Leaguepedia's two V5 pages. Leaguepedia
 * stores the `info` block alone for some games, so the `metadata` wrapper is rebuilt from it, as
 * leaguepedia-v5-export does. Nothing is stored here: the caller passes the result to importGame,
 * which validates it and writes the bucket copy.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readLolImport, type LolImportPayload } from "@gc-stats/storage";
import type { RiotMatchDto, RiotTimelineDto } from "@gc-stats/lol-stats-engine";
import { fetchLeaguepediaPages, type LeaguepediaError, type LeaguepediaPage } from "@/lib/leaguepedia-client";

/** fetch: the bucket, or Leaguepedia when the game is not there. renew: Leaguepedia, always. reprocess: the bucket only. */
export type LeaguepediaGameMode = "fetch" | "renew" | "reprocess";

export type LeaguepediaGameError =
  | { kind: "leaguepedia"; error: LeaguepediaError }
  | { kind: "notInBucket" }
  | { kind: "statsPageMissing" }
  | { kind: "notMatchJson" }
  | { kind: "wrongGame" }
  | { kind: "timelineMissing" };

export type LeaguepediaGameResult = { ok: true; payload: LolImportPayload; fromBucket: boolean } | { ok: false; error: LeaguepediaGameError };

interface Participant {
  participantId: number;
  puuid: string;
}

const DATA_VERSION = "2";

export async function loadLeaguepediaGame(riotMatchId: string, mode: LeaguepediaGameMode): Promise<LeaguepediaGameResult> {
  if (mode !== "renew") {
    const stored = await readLolImport("leaguepedia", riotMatchId);
    if (stored) return { ok: true, payload: stored, fromBucket: true };
    if (mode === "reprocess") return { ok: false, error: { kind: "notInBucket" } };
  }

  const pages = await fetchLeaguepediaPages([`V5 data:${riotMatchId}`, `V5 data:${riotMatchId}/Timeline`]);
  if (!pages.ok) return { ok: false, error: { kind: "leaguepedia", error: pages.error } };
  return parseGamePages(riotMatchId, pages.data);
}

/** Builds the match and timeline from the two page contents. Exported so the parse can be checked on its own. */
export function parseGamePages(riotMatchId: string, pages: LeaguepediaPage[]): LeaguepediaGameResult {
  const statsText = pageText(pages, `V5 data:${riotMatchId}`);
  if (statsText === null) return { ok: false, error: { kind: "statsPageMissing" } };

  const match = riotMatch(parseJson(statsText));
  if (!match) return { ok: false, error: { kind: "notMatchJson" } };
  if (match.metadata.matchId !== riotMatchId) return { ok: false, error: { kind: "wrongGame" } };

  const timelineText = pageText(pages, `V5 data:${riotMatchId}/Timeline`);
  const timeline = timelineText === null ? null : riotTimeline(parseJson(timelineText), riotMatchId, match.info.gameId);
  if (!timeline) return { ok: false, error: { kind: "timelineMissing" } };

  return { ok: true, payload: { match, timeline }, fromBucket: false };
}

/** The wiki returns titles with spaces where the request had underscores; the two are the same page. */
function pageText(pages: LeaguepediaPage[], title: string): string | null {
  const wanted = title.replaceAll("_", " ");
  return pages.find((page) => page.title === wanted)?.wikitext ?? null;
}

/** A full Match-V5 match, or the `info` block alone with the `metadata` rebuilt from it. */
function riotMatch(stored: unknown): RiotMatchDto | null {
  if (isRecord(stored) && isRecord(stored.metadata) && isRecord(stored.info)) return stored as unknown as RiotMatchDto;
  if (!isRecord(stored)) return null;

  const { platformId, gameId, participants } = stored;
  if (typeof platformId !== "string" || typeof gameId !== "number" || !isParticipants(participants)) return null;
  return {
    metadata: { dataVersion: DATA_VERSION, matchId: `${platformId}_${gameId}`, participants: getParticipantsPuuids(participants) },
    info: stored as unknown as RiotMatchDto["info"],
  };
}

/** A full timeline, or the timeline `info` alone. The info must belong to the same game as the match. */
function riotTimeline(stored: unknown, matchId: string, gameId: number): RiotTimelineDto | null {
  if (isRecord(stored) && isRecord(stored.metadata) && isRecord(stored.info)) return stored as unknown as RiotTimelineDto;
  if (!isRecord(stored)) return null;

  const { frames, participants } = stored;
  if (!Array.isArray(frames) || !isParticipants(participants) || stored.gameId !== gameId) return null;
  return {
    metadata: { dataVersion: DATA_VERSION, matchId, participants: getParticipantsPuuids(participants) },
    info: stored as unknown as RiotTimelineDto["info"],
  };
}

function getParticipantsPuuids(participants: Participant[]): string[] {
  return [...participants].sort((a, b) => a.participantId - b.participantId).map((p) => p.puuid);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isParticipants(value: unknown): value is Participant[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((p) => isRecord(p) && typeof p.participantId === "number" && typeof p.puuid === "string")
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
