/**
 * GC-Stats - lol-icons
 *
 * Where the League icons live in the public bucket: champions, items, summoner spells and runes, one WebP
 * file each. The keys carry no patch version, so a new patch only adds the icons it brings. The import copies
 * the missing ones (storeMissingIcons in data-dragon-client), and pages build their URLs from these helpers with no request to
 * Riot or Data Dragon.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { tryPublicUrl } from "@gc-stats/storage";

export type LolIconKind = "champions" | "items" | "spells" | "runes";

/** Champions by Data Dragon's internal key ("MonkeyKing"); items, spells and runes by their numeric id. */
export function lolIconKey(kind: LolIconKind, id: string): string {
  return `lol/${kind}/${id}.webp`;
}

export function lolIconUrl(kind: LolIconKind, id: string): string | null {
  return tryPublicUrl(lolIconKey(kind, id));
}
