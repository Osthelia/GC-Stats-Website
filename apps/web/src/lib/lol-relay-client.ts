/**
 * GC-Stats - lol-relay-client
 *
 * The League routes of RiotRelay: the Match-V5 match and its timeline, cached by the relay, and two lookups that are
 * never cached (an account by Riot ID, a player's tournament-code match ids). The payloads come back as Riot sent
 * them. A match is requested from its platform's cluster (see riotCluster), and never from a second region: the relay
 * refuses a cluster that does not match the id. Renew returns the fresh payload too, so the caller needs no GET after
 * it. Never throws.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotMatchDto, RiotTimelineDto } from "@gc-stats/lol-stats-engine";
import { callRelay, relayConfig, type RelayResult, type RiotRelayError } from "./riot-relay-transport";

function matchPath(cluster: string, riotMatchId: string, suffix: string): string {
  return `/lol/match/${cluster}/${encodeURIComponent(riotMatchId)}${suffix}`;
}

export async function getLolMatch(cluster: string, riotMatchId: string): Promise<RelayResult<RiotMatchDto>> {
  const config = relayConfig();
  if (!config) return missingConfig();
  return callRelay<RiotMatchDto>(matchPath(cluster, riotMatchId, ""), { method: "GET" }, config);
}

export async function getLolTimeline(cluster: string, riotMatchId: string): Promise<RelayResult<RiotTimelineDto>> {
  const config = relayConfig();
  if (!config) return missingConfig();
  return callRelay<RiotTimelineDto>(matchPath(cluster, riotMatchId, "/timeline"), { method: "GET" }, config);
}

/** Asks the relay to fetch the match from Riot again, and returns that fresh copy. */
export async function renewLolMatch(cluster: string, riotMatchId: string): Promise<RelayResult<RiotMatchDto>> {
  const config = relayConfig();
  if (!config) return missingConfig();
  return callRelay<RiotMatchDto>(matchPath(cluster, riotMatchId, "/renew"), { method: "POST" }, config);
}

/** Asks the relay to fetch the timeline from Riot again, and returns that fresh copy. */
export async function renewLolTimeline(cluster: string, riotMatchId: string): Promise<RelayResult<RiotTimelineDto>> {
  const config = relayConfig();
  if (!config) return missingConfig();
  return callRelay<RiotTimelineDto>(matchPath(cluster, riotMatchId, "/timeline/renew"), { method: "POST" }, config);
}

/** The Riot account of a Riot ID (account-v1). */
export interface LolAccountDto {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export async function getLolAccountByRiotId(cluster: string, gameName: string, tagLine: string): Promise<RelayResult<LolAccountDto>> {
  const config = relayConfig();
  if (!config) return missingConfig();
  const path = `/lol/account/${cluster}/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return callRelay<LolAccountDto>(path, { method: "GET" }, config);
}

export interface TourneyMatchWindow {
  /** Epoch seconds. */
  startTime: number;
  /** Epoch seconds, after startTime. */
  endTime: number;
  /** How many ids at most, 1 to 100. */
  count: number;
}

/** The ids of the games a player played with a tournament code inside the given window. */
export async function getLolTourneyMatchIds(cluster: string, puuid: string, window: TourneyMatchWindow): Promise<RelayResult<string[]>> {
  const config = relayConfig();
  if (!config) return missingConfig();
  const query = new URLSearchParams({ type: "tourney", startTime: String(window.startTime), endTime: String(window.endTime), count: String(window.count) });
  return callRelay<string[]>(`/lol/matches/${cluster}/by-puuid/${encodeURIComponent(puuid)}?${query}`, { method: "GET" }, config);
}

export function relayFailureKind(error: RiotRelayError): "missingConfig" | "riotUnavailable" {
  return error.kind === "missingConfig" ? "missingConfig" : "riotUnavailable";
}

function missingConfig(): { ok: false; error: RiotRelayError } {
  return { ok: false, error: { kind: "missingConfig" } };
}
