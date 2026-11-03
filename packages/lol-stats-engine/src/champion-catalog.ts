/**
 * GC-Stats — champion-catalog module
 *
 * Pure helpers for the Data Dragon champion catalog: the patch a game was played on, the Data Dragon
 * version that names it, the stored version to fall back to, and the champion ids a game uses that the
 * catalog does not name. No I/O: the web app fetches and stores the catalog and asks these what to use.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotMatchDto } from "./types";

/** The patch of a game version: "15.18.712.3409" → "15.18". Null when the version has no major and minor. */
export function patchOf(gameVersion: string): string | null {
  return /^(\d+\.\d+)(?:\.|$)/.exec(gameVersion)?.[1] ?? null;
}

/**
 * Riot's internal patch numbers run ten behind the names fans use: internal 16.13 is patch 26.13. From 2025 on
 * the public major is the internal one plus 10; the first three patches of 2025 were named "25.S1.1" to "25.S1.3"
 * (internal 15.1 to 15.3). Patches before 2025 are named the same in both. The page and the stored match patch use
 * the public name, Data Dragon and the game versions the internal one.
 */
export function publicPatch(internalPatch: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(internalPatch);
  if (!match) return internalPatch;
  const major = Number(match[1]);
  if (major < 15) return internalPatch;
  if (major === 15 && Number(match[2]) <= 3) return `25.S1.${match[2]}`;
  return `${major + 10}.${match[2]}`;
}

/** The internal patch of a public one, for the Data Dragon lookups: "26.13" → "16.13", "25.S1.2" → "15.2". A patch that isn't recognised is returned as it is. */
export function internalPatch(publicName: string): string {
  const season = /^25\.S1\.(\d+)$/.exec(publicName);
  if (season) return `15.${season[1]}`;
  const match = /^(\d+)\.(\d+)$/.exec(publicName);
  if (!match || Number(match[1]) < 25) return publicName;
  return `${Number(match[1]) - 10}.${match[2]}`;
}

export function sortPatchesNewestFirst(patches: string[]): string[] {
  return [...patches].sort((a, b) => compareVersions(internalPatch(b), internalPatch(a)));
}

/** Compares dotted versions number by number, so "15.18.10" is newer than "15.18.9". */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * The Data Dragon version of a patch, from Data Dragon's own version list. The list is newest first, so the
 * first version of the patch is its newest. Null while the patch has no Data Dragon version yet.
 */
export function pickDataDragonVersion(versions: string[], patch: string): string | null {
  return versions.find((version) => version.startsWith(`${patch}.`)) ?? null;
}

/**
 * The stored version to use when Data Dragon cannot be asked. A version from the game's patch or an earlier
 * one matches what was played, so the newest of those wins. A later version is only used when no earlier one
 * is stored.
 */
export function pickStoredVersion(storedVersions: string[], patch: string): string | null {
  const newestFirst = [...storedVersions].sort((a, b) => compareVersions(b, a));
  return newestFirst.find((version) => compareVersions(patchOf(version) ?? "0", patch) <= 0) ?? newestFirst[0] ?? null;
}

/** Every champion id the game uses (the ten picks and the bans) that the catalog does not name. Sorted, without repeats. */
export function missingChampionIds(match: RiotMatchDto, championNameById: Map<number, string>): number[] {
  const used = [
    ...match.info.participants.map((p) => p.championId),
    // Riot uses -1 for an empty ban slot.
    ...match.info.teams.flatMap((team) => team.bans.map((ban) => ban.championId).filter((id) => id > 0)),
  ];
  return [...new Set(used.filter((id) => !championNameById.has(id)))].sort((a, b) => a - b);
}

/**
 * The display name of a champion id. Throws when the catalog does not name it: the import checks
 * missingChampionIds before it stores anything, so a name is never guessed or left as a placeholder.
 */
export function championNameOf(championNameById: Map<number, string>, championId: number): string {
  const name = championNameById.get(championId);
  if (name === undefined) throw new Error(`No champion name for champion id ${championId}`);
  return name;
}
