/**
 * GC-Stats — test-helpers module
 *
 * Shared by the tests that build a game summary from a real fixture. The summary refuses a champion the
 * catalog does not name, so these tests name every champion of the game with its internal name.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotMatchDto } from "./types";

export function namesForEveryChampion(match: RiotMatchDto): Map<number, string> {
  const names = new Map<number, string>();
  for (const p of match.info.participants) names.set(p.championId, p.championName);
  for (const team of match.info.teams) {
    for (const ban of team.bans) if (ban.championId > 0) names.set(ban.championId, String(ban.championId));
  }
  return names;
}
