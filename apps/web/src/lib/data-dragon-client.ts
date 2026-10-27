/**
 * GC-Stats - data-dragon-client
 *
 * Champion and item names of a patch, from Riot's Data Dragon CDN (public, no key). Match-V5 gives numeric
 * champion and item ids, so the names come from here. Each Data Dragon version is stored once in
 * lol_data_dragon_catalogs and never fetched again, because a published version does not change. An import
 * reads the stored names, so it needs Data Dragon only the first time a version is used. Never throws: a
 * failure comes back as a typed error, and the caller stores nothing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { lolDataDragonCatalogs } from "@gc-stats/db";
import { compareVersions, patchOf, pickDataDragonVersion, pickStoredVersion } from "@gc-stats/lol-stats-engine";

const DATA_DRAGON_BASE = "https://ddragon.leagueoflegends.com";
const LOCALE = "en_US";

export interface DataDragonCatalog {
  /** The Data Dragon version the names come from, e.g. "15.18.1". */
  version: string;
  championNameById: Map<number, string>;
  /** Data Dragon's internal champion key ("MonkeyKing"), the name its image URLs use. */
  championKeyById: Map<number, string>;
  itemNameById: Map<number, string>;
}

export type ChampionCatalogResult = { ok: true; catalog: DataDragonCatalog } | { ok: false; error: { kind: "dataDragonUnavailable" } };

/** The stored shape: keyed by the numeric id as a string. */
export type ChampionRecords = Record<string, { name: string; key: string }>;
export type ItemRecords = Record<string, string>;

interface ChampionFile {
  data: Record<string, { id: string; key: string; name: string }>;
}

interface ItemFile {
  data: Record<string, { name: string }>;
}

/** Catalogs already read in this process, by Data Dragon version. A version never changes, so they are kept. */
const loaded = new Map<string, DataDragonCatalog>();

/**
 * The names of the patch a game was played on. In order: a catalog already loaded, the stored catalog of the
 * patch's Data Dragon version, Data Dragon itself (stored from then on), and last a stored catalog that fits
 * the patch (see pickStoredVersion) for a patch Data Dragon has no version of yet, or cannot be reached about.
 */
export async function getChampionCatalog(gameVersion: string): Promise<ChampionCatalogResult> {
  const patch = patchOf(gameVersion);
  if (!patch) return unavailable(`unreadable game version ${JSON.stringify(gameVersion)}`);
  try {
    const catalog = fromMemory(patch) ?? (await fromDatabase(patch)) ?? (await fetchFromDataDragon(patch)) ?? (await fallbackFromDatabase(patch));
    return catalog ? { ok: true, catalog } : unavailable(`no catalog for patch ${patch}`);
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : String(err));
  }
}

function unavailable(reason: string): { ok: false; error: { kind: "dataDragonUnavailable" } } {
  console.warn(`[data-dragon] ${reason}`);
  return { ok: false, error: { kind: "dataDragonUnavailable" } };
}

/** champion.json is keyed by name. Each entry's `key` is the numeric id Match-V5 uses ("103" for Ahri), and `id` is the internal name. */
export function parseChampionNames(file: ChampionFile): ChampionRecords {
  const records: ChampionRecords = {};
  for (const champion of Object.values(file.data)) {
    if (Number.isInteger(Number(champion.key))) records[champion.key] = { name: champion.name, key: champion.id };
  }
  return records;
}

/** item.json is keyed by the numeric item id as a string (e.g. "3089"). */
export function parseItemNames(file: ItemFile): ItemRecords {
  const records: ItemRecords = {};
  for (const [key, item] of Object.entries(file.data)) {
    if (Number.isInteger(Number(key))) records[key] = item.name;
  }
  return records;
}

function fromMemory(patch: string): DataDragonCatalog | null {
  const version = newestVersion([...loaded.keys()].filter((v) => patchOf(v) === patch));
  return version === null ? null : (loaded.get(version) ?? null);
}

/** The stored catalog of the patch's newest Data Dragon version. */
async function fromDatabase(patch: string): Promise<DataDragonCatalog | null> {
  const version = newestVersion((await storedVersions()).filter((v) => patchOf(v) === patch));
  return version === null ? null : loadStored(version);
}

/** Asks Data Dragon for the patch's newest version and stores it. Null while the patch has no version yet, or when the request fails. */
async function fetchFromDataDragon(patch: string): Promise<DataDragonCatalog | null> {
  try {
    const versions = await getJson<string[]>(`${DATA_DRAGON_BASE}/api/versions.json`);
    const version = pickDataDragonVersion(versions, patch);
    if (version === null) return null;
    const [champions, items] = await Promise.all([
      getJson<ChampionFile>(`${DATA_DRAGON_BASE}/cdn/${version}/data/${LOCALE}/champion.json`),
      getJson<ItemFile>(`${DATA_DRAGON_BASE}/cdn/${version}/data/${LOCALE}/item.json`),
    ]);
    const championRecords = parseChampionNames(champions);
    const itemRecords = parseItemNames(items);
    await storeCatalog(version, championRecords, itemRecords);
    return remember(version, championRecords, itemRecords);
  } catch (err) {
    console.warn(`[data-dragon] catalog request error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** A stored catalog for a patch Data Dragon has no version of yet, or cannot be asked about. pickStoredVersion decides which. */
async function fallbackFromDatabase(patch: string): Promise<DataDragonCatalog | null> {
  const version = pickStoredVersion(await storedVersions(), patch);
  return version === null ? null : loadStored(version);
}

async function storedVersions(): Promise<string[]> {
  const rows = await db.select({ version: lolDataDragonCatalogs.version }).from(lolDataDragonCatalogs);
  return rows.map((row) => row.version);
}

async function loadStored(version: string): Promise<DataDragonCatalog | null> {
  const [row] = await db
    .select({ champions: lolDataDragonCatalogs.champions, items: lolDataDragonCatalogs.items })
    .from(lolDataDragonCatalogs)
    .where(eq(lolDataDragonCatalogs.version, version));
  return row ? remember(version, row.champions, row.items) : null;
}

/**
 * Two imports can race on the same new version, so the second insert does nothing. A failed write only means
 * the next import fetches the version again, so it is logged and not thrown.
 */
async function storeCatalog(version: string, champions: ChampionRecords, items: ItemRecords): Promise<void> {
  try {
    await db.insert(lolDataDragonCatalogs).values({ version, champions, items }).onConflictDoNothing();
  } catch (err) {
    console.warn(`[data-dragon] could not store ${version}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function remember(version: string, champions: ChampionRecords, items: ItemRecords): DataDragonCatalog {
  const catalog: DataDragonCatalog = {
    version,
    championNameById: new Map(Object.entries(champions).map(([id, c]) => [Number(id), c.name])),
    championKeyById: new Map(Object.entries(champions).map(([id, c]) => [Number(id), c.key])),
    itemNameById: new Map(Object.entries(items).map(([id, name]) => [Number(id), name])),
  };
  loaded.set(version, catalog);
  return catalog;
}

/** The newest of some versions, by version number. */
function newestVersion(versions: string[]): string | null {
  return [...versions].sort((a, b) => compareVersions(b, a))[0] ?? null;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned status ${response.status}`);
  return (await response.json()) as T;
}
