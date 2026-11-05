/**
 * GC-Stats — data-dragon-icons module
 *
 * Pure helpers for the per-patch icon sync: which items belong on Summoner's Rift, and which icons of a
 * version are not in the bucket yet. No I/O: the web app reads Data Dragon and the stored rows and asks
 * these what to upload.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type DataDragonIconKind = "champions" | "items" | "spells" | "runes";

export interface DataDragonIconRef {
  kind: DataDragonIconKind;
  id: string;
}

/** Data Dragon's map id for Summoner's Rift, the only map a tournament game is played on. */
const SUMMONERS_RIFT_MAP_ID = "11";

/** The ids of the items that can be bought on Summoner's Rift. Arena and ARAM items are left out. */
export function summonersRiftItemIds(items: Record<string, { maps?: Record<string, boolean> }>): string[] {
  return Object.entries(items)
    .filter(([id, item]) => Number.isInteger(Number(id)) && item.maps?.[SUMMONERS_RIFT_MAP_ID] === true)
    .map(([id]) => id);
}

/** The icons of a version that no stored row covers yet. Order and duplicates of `wanted` are kept apart: each icon comes back once. */
export function missingIcons(wanted: DataDragonIconRef[], stored: DataDragonIconRef[]): DataDragonIconRef[] {
  const have = new Set(stored.map(iconKey));
  const seen = new Set<string>();
  return wanted.filter((icon) => {
    const key = iconKey(icon);
    if (have.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function iconKey(icon: DataDragonIconRef): string {
  return `${icon.kind}/${icon.id}`;
}
