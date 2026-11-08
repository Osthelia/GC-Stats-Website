/**
 * GC-Stats — match-id module
 *
 * Riot match ids and where the relay serves them. A match id is "<platform>_<number>", e.g. "EUW1_123".
 * The relay routes a match by its platform's region cluster. Tournament-realm games (LOLTMNT…) are not served
 * by the public API, so they are never requested. The platform table mirrors RiotRelay's platform_region.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const CLUSTER_BY_PLATFORM: Record<string, string> = {
  NA1: "americas",
  BR1: "americas",
  LA1: "americas",
  LA2: "americas",
  EUW1: "europe",
  EUN1: "europe",
  TR1: "europe",
  RU: "europe",
  ME1: "europe",
  KR: "asia",
  JP1: "asia",
  OC1: "sea",
  PH2: "sea",
  SG2: "sea",
  TH2: "sea",
  TW2: "sea",
  VN2: "sea",
};

const RIOT_MATCH_ID = /^([A-Z0-9]+)_[0-9]+$/;

const TOURNAMENT_REALM_PREFIX = "LOLTMNT";

/** Checks if MatchId or Platform is from the tournament realm */
export function isTournamentRealm(matchIdOrPlatform: string): boolean {
  return matchIdOrPlatform.startsWith(TOURNAMENT_REALM_PREFIX);
}

/** The platform of a match id ("EUW1_123" → "EUW1", "LOLTMNT01_5" → "LOLTMNT01"). Null for a malformed id. */
export function platformOfMatchId(riotMatchId: string): string | null {
  return RIOT_MATCH_ID.exec(riotMatchId)?.[1] ?? null;
}

/** The routing cluster of a platform ("EUW1" → "europe"). Null for the tournament realm and unknown platforms. */
export function clusterForPlatform(platform: string): string | null {
  if (isTournamentRealm(platform)) return null;
  return CLUSTER_BY_PLATFORM[platform] ?? null;
}

/** The routing cluster of a match id ("EUW1_123" → "europe"). Null when the relay cannot serve it. */
export function riotCluster(riotMatchId: string): string | null {
  const platform = platformOfMatchId(riotMatchId);
  return platform === null ? null : clusterForPlatform(platform);
}

export const TOURNAMENT_REALM = "tournament";

/** Where an account or a game lives: the cluster of a live platform, or "tournament". */
export function realmOf(account: { platform: string | null; cluster: string | null }): string | null {
  if (account.platform !== null) return isTournamentRealm(account.platform) ? TOURNAMENT_REALM : clusterForPlatform(account.platform);
  return account.cluster;
}

export type RegionCluster = { kind: "cluster"; cluster: string } | { kind: "ask" } | { kind: "unsupported" };

export function clusterForRegion(regionKey: string): RegionCluster {
  switch (regionKey) {
    case "emea":
      return { kind: "cluster", cluster: "europe" };
    case "na":
    case "latam":
    case "brazil":
      return { kind: "cluster", cluster: "americas" };
    case "korea":
      return { kind: "cluster", cluster: "asia" };
    case "oceania":
      return { kind: "cluster", cluster: "sea" };
    case "china":
      return { kind: "unsupported" };
    default:
      return { kind: "ask" };
  }
}
