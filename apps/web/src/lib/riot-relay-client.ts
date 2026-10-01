/**
 * GC-Stats - riot-relay-client
 *
 * Client for RiotRelay (a separate Rust service), a thin cache/proxy in
 * front of the official Riot match-v1 API. On GET/renew it returns the
 * Riot payload byte-for-byte, so `RiotMatchDto` here is exactly Riot's own
 * contract. Mirrors twitch-client.ts conventions: env read at the point of
 * use, never throws, `console.warn` on unexpected failures.
 *
 * On Cloudflare, RiotRelay stays 100% private on the operator's VPS and is
 * reached through a Workers VPC service (`RIOT_RELAY` binding), never a
 * public URL. `RIOT_RELAY_URL` only applies to the self-hosted Docker
 * deploy, where RiotRelay is called directly.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { RiotMatchDto } from "@gc-stats/map-stats-engine";

const VPC_BASE_URL = "http://gcs-riotrelay:3000";

export type RiotRelayRegion = "ap" | "br" | "esports" | "eu" | "kr" | "latam" | "na";
export const RIOT_RELAY_REGIONS: RiotRelayRegion[] = ["ap", "br", "esports", "eu", "kr", "latam", "na"];

export type RiotRelayError =
  | { kind: "missingConfig" }
  | { kind: "invalidRequest" }
  | { kind: "relayUnauthorized" }
  | { kind: "riotUnauthorized" }
  | { kind: "notFound" }
  | { kind: "rateLimited"; retryAfterSeconds: number | null }
  | { kind: "relayUnreachable" }
  | { kind: "cacheUnavailable" }
  | { kind: "riotError"; status: number }
  | { kind: "networkError" }
  | { kind: "invalidResponse" }
  | { kind: "unknown"; status: number };

export type RiotRelayResult<T> = { ok: true; data: T; servedByRegion: RiotRelayRegion } | { ok: false; error: RiotRelayError };

function baseConfig(): { url: string; token: string } | null {
  const token = process.env.RIOT_RELAY_TOKEN;
  if (!token) return null;

  if (process.env.DEPLOY_TARGET === "cloudflare") {
    return { url: VPC_BASE_URL, token };
  }

  const url = process.env.RIOT_RELAY_URL;
  if (!url) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function resolveFetch(): typeof fetch {
  if (process.env.DEPLOY_TARGET !== "cloudflare") return fetch;
  const { env } = getCloudflareContext();
  return env.RIOT_RELAY.fetch.bind(env.RIOT_RELAY) as typeof fetch;
}

async function classifyErrorResponse(response: Response): Promise<RiotRelayError> {
  if (response.status === 400) return { kind: "invalidRequest" };
  if (response.status === 401) {
    const body = await response.json().catch(() => null);
    if (body && typeof body === "object" && (body as { error?: string }).error === "unauthorized") {
      return { kind: "relayUnauthorized" };
    }
    return { kind: "riotUnauthorized" };
  }
  if (response.status === 403) return { kind: "riotUnauthorized" };
  if (response.status === 404) return { kind: "notFound" };
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    return { kind: "rateLimited", retryAfterSeconds: retryAfter ? Number(retryAfter) || null : null };
  }
  if (response.status === 502) return { kind: "relayUnreachable" };
  if (response.status === 503) return { kind: "cacheUnavailable" };
  if (response.status >= 500) return { kind: "riotError", status: response.status };
  return { kind: "unknown", status: response.status };
}

async function callRelay<T>(path: string, init: RequestInit, config: { url: string; token: string }): Promise<RiotRelayResult<T>> {
  let response: Response;
  try {
    response = await resolveFetch()(`${config.url}${path}`, { ...init, headers: { ...init.headers, Authorization: config.token } });
  } catch (err) {
    console.warn(`[riot-relay] network error calling ${path}: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, error: { kind: "networkError" } };
  }

  if (!response.ok) {
    return { ok: false, error: await classifyErrorResponse(response) };
  }

  try {
    const data = (await response.json()) as T;
    return { ok: true, data, servedByRegion: "na" as RiotRelayRegion }; // overwritten by caller when region matters
  } catch {
    return { ok: false, error: { kind: "invalidResponse" } };
  }
}

function isOurSideError(error: RiotRelayError): boolean {
  return error.kind === "missingConfig" || error.kind === "invalidRequest" || error.kind === "relayUnauthorized";
}

/** GET a match. Retries once against the fixed `esports` region on failure (VALORANT esports matches live on a separate Riot dataset than the tournament's own region). */
export async function getMatch(region: RiotRelayRegion, matchId: string): Promise<RiotRelayResult<RiotMatchDto>> {
  const config = baseConfig();
  if (!config) return { ok: false, error: { kind: "missingConfig" } };

  const first = await callRelay<RiotMatchDto>(`/match/${region}/${encodeURIComponent(matchId)}`, { method: "GET" }, config);
  if (first.ok) return { ...first, servedByRegion: region };
  if (region === "esports" || isOurSideError(first.error)) return first;

  const retry = await callRelay<RiotMatchDto>(`/match/esports/${encodeURIComponent(matchId)}`, { method: "GET" }, config);
  return retry.ok ? { ...retry, servedByRegion: "esports" } : retry;
}

/** Forces the relay to refetch this match from Riot (cache refresh only — does not return the data). */
export async function renewMatch(region: RiotRelayRegion, matchId: string): Promise<RiotRelayResult<void>> {
  const config = baseConfig();
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
  const config = baseConfig();
  if (!config) return { ok: false, error: { kind: "missingConfig" } };

  const body = JSON.stringify({
    segments: segments.map((s) => ({ matchId: s.matchId, startRound: s.startRound - 1, endRound: s.endRound - 1 })),
  });

  const result = await callRelay<RiotMatchDto>(`/match/${region}/merge`, { method: "POST", headers: { "Content-Type": "application/json" }, body }, config);
  return result.ok ? { ...result, servedByRegion: region } : result;
}
