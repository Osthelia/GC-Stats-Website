/**
 * GC-Stats - data-dragon-client
 *
 * Champion and item names from Riot's Data Dragon CDN: public, no key. Match-V5 gives
 * numeric championId and item ids, so the names come from here. Mirrors riot-content-client.ts:
 * module-level cache (one day), fail-open, never throws. On failure the catalog is empty and
 * callers fall back to the ids.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const DATA_DRAGON_BASE = "https://ddragon.leagueoflegends.com";
const LOCALE = "en_US";
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

export interface DataDragonCatalog {
  /** Data Dragon patch version the names come from, e.g. "16.5.1". Empty when the catalog failed to load. */
  version: string;
  championNameById: Map<number, string>;
  itemNameById: Map<number, string>;
}

interface ChampionFile {
  data: Record<string, { key: string; name: string }>;
}

interface ItemFile {
  data: Record<string, { name: string }>;
}

let cache: { value: DataDragonCatalog; expiresAt: number } | undefined;

export async function getDataDragonCatalog(): Promise<DataDragonCatalog> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  try {
    const version = await latestVersion();
    const [champions, items] = await Promise.all([
      getJson<ChampionFile>(`${DATA_DRAGON_BASE}/cdn/${version}/data/${LOCALE}/champion.json`),
      getJson<ItemFile>(`${DATA_DRAGON_BASE}/cdn/${version}/data/${LOCALE}/item.json`),
    ]);
    const value: DataDragonCatalog = {
      version,
      championNameById: parseChampionNames(champions),
      itemNameById: parseItemNames(items),
    };
    cache = { value, expiresAt: Date.now() + CATALOG_TTL_MS };
    return value;
  } catch (err) {
    console.warn(`[data-dragon] catalog request error: ${err instanceof Error ? err.message : String(err)}`);
    return { version: "", championNameById: new Map(), itemNameById: new Map() };
  }
}

/** champion.json is keyed by name, and each entry's `key` is the numeric id Match-V5 uses (e.g. "103" for Ahri). */
export function parseChampionNames(file: ChampionFile): Map<number, string> {
  const names = new Map<number, string>();
  for (const champion of Object.values(file.data)) {
    const id = Number(champion.key);
    if (Number.isInteger(id)) names.set(id, champion.name);
  }
  return names;
}

/** item.json is keyed by the numeric item id as a string (e.g. "3089"). */
export function parseItemNames(file: ItemFile): Map<number, string> {
  const names = new Map<number, string>();
  for (const [key, item] of Object.entries(file.data)) {
    const id = Number(key);
    if (Number.isInteger(id)) names.set(id, item.name);
  }
  return names;
}

async function latestVersion(): Promise<string> {
  const versions = await getJson<string[]>(`${DATA_DRAGON_BASE}/api/versions.json`);
  const latest = versions[0];
  if (!latest) throw new Error("versions.json is empty");
  return latest;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned status ${response.status}`);
  return (await response.json()) as T;
}
