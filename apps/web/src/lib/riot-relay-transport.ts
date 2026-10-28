/**
 * GC-Stats - riot-relay-transport
 *
 * The request side of RiotRelay (a separate Rust service): where it is reached, how a request is sent, and how
 * a failed answer becomes a typed error. The Valorant client (riot-relay-client) and the League client
 * (lol-relay-client) both use it. Never throws.
 *
 * On Cloudflare, RiotRelay stays 100% private on the operator's VPS and is reached through a Workers VPC
 * service (`RIOT_RELAY` binding), never a public URL. `RIOT_RELAY_URL` only applies to the self-hosted Docker
 * deploy, where RiotRelay is called directly.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

const VPC_BASE_URL = "http://gcs-riotrelay:3000";

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

export type RelayResult<T> = { ok: true; data: T } | { ok: false; error: RiotRelayError };

export function relayConfig(): { url: string; token: string } | null {
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

export async function callRelay<T>(path: string, init: RequestInit, config: { url: string; token: string }): Promise<RelayResult<T>> {
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
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, error: { kind: "invalidResponse" } };
  }
}
