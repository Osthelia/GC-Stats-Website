/**
 * GC-Stats - logo-response
 *
 * Shapes admin logo records into the public API v1/v2 response formats
 * (theme-agnostic for v1, dark/light pairs for v2), with per-theme fallback.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getEntityLogos, getEntityLogosBatch, currentLogo, logoAt, type LogoEntityType, type AdminLogoEntry } from "@/lib/admin-logos";

export type ApiLogoUrls = { url_200x200: string | null; url_full: string | null };
export type ApiLogoEntry = { uuid: string; url_200x200: string | null; url_full: string | null; from: string | null; until: string | null };
export type ApiLogoHistoryResponse = { current: ApiLogoEntry | null; history: ApiLogoEntry[] };

function toApiLogoUrls(entry: AdminLogoEntry): ApiLogoUrls {
  return { url_200x200: entry.thumbnailUrl, url_full: entry.url };
}

function toApiLogoEntry(entry: AdminLogoEntry): ApiLogoEntry {
  return { uuid: entry.id, ...toApiLogoUrls(entry), from: entry.since, until: entry.until };
}

/** Current logo only (theme-agnostic preference, same resolution order as `currentLogo`) — used on team/player/tournament detail responses. */
export async function getLogoUrls(entityType: LogoEntityType, entityId: number): Promise<ApiLogoUrls | null> {
  const entries = await getEntityLogos(entityType, entityId);
  const current = currentLogo(entries);
  return current ? toApiLogoUrls(current) : null;
}

export type ApiThemedLogoUrls = { dark: ApiLogoUrls | null; light: ApiLogoUrls | null };

/** Both site themes, each with both resolutions — used by V2 entity responses (V1 stays theme-agnostic, see `getLogoUrls`). Falls back to the theme-agnostic entry for whichever theme has none of its own. */
export async function getThemedLogoUrls(entityType: LogoEntityType, entityId: number): Promise<ApiThemedLogoUrls> {
  const entries = await getEntityLogos(entityType, entityId);
  const dark = currentLogo(entries, "dark");
  const light = currentLogo(entries, "light");
  return { dark: dark ? toApiLogoUrls(dark) : null, light: light ? toApiLogoUrls(light) : null };
}

/** Themed logos in effect on `atDate` ("YYYY-MM-DD"), or the current ones when `atDate` is null. */
export function themedApiLogoUrlsAt(entries: AdminLogoEntry[], atDate: string | null): ApiThemedLogoUrls {
  const dark = atDate ? logoAt(entries, atDate, "dark") : currentLogo(entries, "dark");
  const light = atDate ? logoAt(entries, atDate, "light") : currentLogo(entries, "light");
  return { dark: dark ? toApiLogoUrls(dark) : null, light: light ? toApiLogoUrls(light) : null };
}

export async function getThemedLogoUrlsBatch(entityType: LogoEntityType, entityIds: number[]): Promise<Map<number, ApiThemedLogoUrls>> {
  const batch = await getEntityLogosBatch(entityType, entityIds);
  const map = new Map<number, ApiThemedLogoUrls>();
  for (const id of entityIds) {
    const entries = batch.get(id) ?? [];
    const dark = currentLogo(entries, "dark");
    const light = currentLogo(entries, "light");
    map.set(id, { dark: dark ? toApiLogoUrls(dark) : null, light: light ? toApiLogoUrls(light) : null });
  }
  return map;
}

export async function getLogoUrlsBatch(entityType: LogoEntityType, entityIds: number[]): Promise<Map<number, ApiLogoUrls | null>> {
  const batch = await getEntityLogosBatch(entityType, entityIds);
  const map = new Map<number, ApiLogoUrls | null>();
  for (const id of entityIds) {
    const current = currentLogo(batch.get(id) ?? []);
    map.set(id, current ? toApiLogoUrls(current) : null);
  }
  return map;
}

/** Mirrors the Rust API's `LogoHistoryResponse` (`current` + `history`, `/{id}/logos` and `/{id}/photos` endpoints). */
export async function getLogoHistoryResponse(entityType: LogoEntityType, entityId: number): Promise<ApiLogoHistoryResponse> {
  const entries = await getEntityLogos(entityType, entityId);
  const current = currentLogo(entries);
  const history = entries.filter((e) => e !== current).map(toApiLogoEntry);
  return { current: current ? toApiLogoEntry(current) : null, history };
}
