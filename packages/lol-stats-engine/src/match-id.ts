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

/** Riot's tournament realm. Its games are on Leaguepedia only. */
export function isTournamentRealmMatchId(riotMatchId: string): boolean {
  return riotMatchId.startsWith("LOLTMNT");
}

/** The routing cluster of a match id ("EUW1_123" → "europe"). Null when the relay cannot serve it. */
export function riotCluster(riotMatchId: string): string | null {
  const platform = RIOT_MATCH_ID.exec(riotMatchId)?.[1];
  if (platform === undefined || isTournamentRealmMatchId(riotMatchId)) return null;
  return CLUSTER_BY_PLATFORM[platform] ?? null;
}
