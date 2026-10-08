/**
 * GC-Stats - riot-region
 *
 * Static, closed mapping from a tournament's free-text `region` field to a
 * Riot relay shard. `tournaments.region` isn't constrained to these keys at
 * the schema level, so an unrecognized value fails the fetch with a clear
 * "region not configured" error rather than guessing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotRelayRegion } from "@/lib/riot-relay-client";

/**
 * Port of V1's config/regions.php — a static, closed mapping from a
 * tournament's free-text `region` field to a Riot relay shard. Unlike V1,
 * `tournaments.region` isn't constrained to these keys at the schema level,
 * so an unrecognized value fails the fetch with a clear "region not
 * configured" error rather than guessing.
 */
const TOURNAMENT_REGION_TO_RIOT: Record<string, RiotRelayRegion> = {
  Americas: "na",
  "North America": "na",
  Brazil: "br",
  LATAM: "latam",
  EMEA: "eu",
  Pacific: "ap",
  Oceania: "ap",
  China: "ap",
  Korea: "ap",
  SEA: "ap",
  International: "esports",
};

export function resolveRiotRegion(tournamentRegion: string | null): RiotRelayRegion | null {
  if (!tournamentRegion) return null;
  return TOURNAMENT_REGION_TO_RIOT[tournamentRegion.trim()] ?? null;
}
