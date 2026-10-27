/**
 * GC-Stats - riot-relay-client
 *
 * Client for RiotRelay's Valorant routes, a thin cache/proxy in front of the official Riot match-v1 API. On
 * GET/renew it returns the Riot payload byte-for-byte, so `RiotMatchDto` here is exactly Riot's own contract.
 * The request side (config, transport, error types) lives in riot-relay-transport, shared with the League client.
 * Mirrors twitch-client.ts conventions: env read at the point of use, never throws, `console.warn` on
 * unexpected failures.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotMatchDto } from "@gc-stats/map-stats-engine";
import { callRelay, relayConfig, type RiotRelayError } from "./riot-relay-transport";

export type { RiotRelayError } from "./riot-relay-transport";

export type RiotRelayRegion = "ap" | "br" | "esports" | "eu" | "kr" | "latam" | "na";
export const RIOT_RELAY_REGIONS: RiotRelayRegion[] = ["ap", "br", "esports", "eu", "kr", "latam", "na"];

export type RiotRelayResult<T> = { ok: true; data: T; servedByRegion: RiotRelayRegion } | { ok: false; error: RiotRelayError };

function isOurSideError(error: RiotRelayError): boolean {
  return error.kind === "missingConfig" || error.kind === "invalidRequest" || error.kind === "relayUnauthorized";
}

/** GET a match. Retries once against the fixed `esports` region on failure (VALORANT esports matches live on a separate Riot dataset than the tournament's own region). */
export async function getMatch(region: RiotRelayRegion, matchId: string): Promise<RiotRelayResult<RiotMatchDto>> {
  const config = relayConfig();
  if (!config) return { ok: false, error: { kind: "missingConfig" } };

  const first = await callRelay<RiotMatchDto>(`/match/${region}/${encodeURIComponent(matchId)}`, { method: "GET" }, config);
  if (first.ok) return { ...first, servedByRegion: region };
  if (region === "esports" || isOurSideError(first.error)) return first;

  const retry = await callRelay<RiotMatchDto>(`/match/esports/${encodeURIComponent(matchId)}`, { method: "GET" }, config);
  return retry.ok ? { ...retry, servedByRegion: "esports" } : retry;
}

/** Forces the relay to refetch this match from Riot (cache refresh only — does not return the data). */
export async function renewMatch(region: RiotRelayRegion, matchId: string): Promise<RiotRelayResult<void>> {
  const config = relayConfig();
  if (!config) return { ok: false, error: { kind: "missingConfig" } };

  const first = await callRelay<void>(`/match/${region}/${encodeURIComponent(matchId)}/renew`, { method: "POST" }, config);
  if (first.ok) return { ...first, servedByRegion: region };
  if (region === "esports" || isOurSideError(first.error)) return first;

  const retry = await callRelay<void>(`/match/esports/${encodeURIComponent(matchId)}/renew`, { method: "POST" }, config);
  return retry.ok ? { ...retry, servedByRegion: "esports" } : retry;
}

export interface MergeSegmentInput {
  matchId: string;
  /** 1-indexed round numbers as entered by the operator; converted to Riot's 0-indexed `roundNum` before the call. */
  startRound: number;
  endRound: number;
}

/** Fuses 2-5 Riot match ids (a game split by a reconnection) into one synthetic "GCS-..." match id. No region retry — the operator picks the region explicitly. */
export async function mergeMatch(region: RiotRelayRegion, segments: MergeSegmentInput[]): Promise<RiotRelayResult<RiotMatchDto>> {
  const config = relayConfig();
  if (!config) return { ok: false, error: { kind: "missingConfig" } };

  const body = JSON.stringify({
    segments: segments.map((s) => ({ matchId: s.matchId, startRound: s.startRound - 1, endRound: s.endRound - 1 })),
  });

  const result = await callRelay<RiotMatchDto>(`/match/${region}/merge`, { method: "POST", headers: { "Content-Type": "application/json" }, body }, config);
  return result.ok ? { ...result, servedByRegion: region } : result;
}
