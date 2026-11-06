/**
 * GC-Stats - data-dragon-client
 *
 * Champion and item names of a patch, from Riot's Data Dragon CDN (public, no key). Match-V5 gives numeric
 * champion and item ids, so the names come from here. Each Data Dragon version is stored once in
 * lol_data_dragon_catalogs (champion, item and rune names) and never fetched again, because a published version
 * does not change. An import reads the stored names, so it needs Data Dragon only the first time a version is
 * used, and pages never ask it. Never throws: a failure comes back as a typed error, and the caller stores
 * nothing. The icons (champions, items, summoner spells, runes) are copied to the public bucket per patch, after
 * the response (syncPatchIcons): every icon of a version once, never failing the import.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { adminDb as db, db as cachedDb } from "@gc-stats/db/client";
import { lolDataDragonCatalogs, lolDataDragonIcons } from "@gc-stats/db";
import { compareVersions, internalPatch, missingIcons, patchOf, pickDataDragonVersion, pickStoredVersion, summonersRiftItemIds, type DataDragonIconRef } from "@gc-stats/lol-stats-engine";
import { convertToWebp, putObject } from "@gc-stats/storage";
import { lolIconKey, lolIconUrl, type LolIconKind } from "./lol-icons";

const DATA_DRAGON_BASE = "https://ddragon.leagueoflegends.com";
const CDN = `${DATA_DRAGON_BASE}/cdn`;
const LOCALE = "en_US";
const ICON_BATCH_SIZE = 8;
const ICON_WEBP_QUALITY = 80;
/** A sync that crashed leaves its lock behind; after this long another import may take it over. */
const ICON_SYNC_LOCK_MINUTES = 10;

export interface DataDragonCatalog {
  /** The Data Dragon version the names come from, e.g. "15.18.1". */
  version: string;
  championNameById: Map<number, string>;
  /** Data Dragon's internal champion key ("MonkeyKing"), the name its image URLs use. */
  championKeyById: Map<number, string>;
  itemNameById: Map<number, string>;
  /** Rune and rune tree names by id. Empty for a version stored before the column, until its first icon sync. */
  runeNames: Record<string, string>;
}

export type ChampionCatalogResult = { ok: true; catalog: DataDragonCatalog } | { ok: false; error: { kind: "dataDragonUnavailable" } };

/** The stored shape: keyed by the numeric id as a string. */
export type ChampionRecords = Record<string, { name: string; key: string }>;
export type ItemRecords = Record<string, string>;
export type RuneRecords = Record<string, string>;

interface ChampionFile {
  data: Record<string, { id: string; key: string; name: string }>;
}

interface ItemFile {
  data: Record<string, { name: string; maps?: Record<string, boolean> }>;
}

interface SummonerFile {
  data: Record<string, { key: string; image: { full: string } }>;
}

/** runesReforged.json: the rune trees, each with its keystone and perk slots. Icon paths are relative to the CDN's img folder. */
interface RuneStyleFile {
  id: number;
  name: string;
  icon: string;
  slots: { runes: { id: number; name: string; icon: string }[] }[];
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

/** Rune ids (trees and perks) to their names. */
export function parseRuneNames(styles: RuneStyleFile[]): RuneRecords {
  const records: RuneRecords = {};
  for (const style of styles) {
    records[String(style.id)] = style.name;
    for (const slot of style.slots) for (const rune of slot.runes) records[String(rune.id)] = rune.name;
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
    const [champions, items, runeStyles] = await Promise.all([
      getJson<ChampionFile>(`${CDN}/${version}/data/${LOCALE}/champion.json`),
      getJson<ItemFile>(`${CDN}/${version}/data/${LOCALE}/item.json`),
      // Rune names are not needed to import a game, so a failed read keeps the catalog; the icon sync fills them in.
      getJson<RuneStyleFile[]>(`${CDN}/${version}/data/${LOCALE}/runesReforged.json`).catch(sourceFailure),
    ]);
    const championRecords = parseChampionNames(champions);
    const itemRecords = parseItemNames(items);
    const runeRecords = runeStyles ? parseRuneNames(runeStyles) : null;
    await storeCatalog(version, championRecords, itemRecords, runeRecords);
    return remember(version, championRecords, itemRecords, runeRecords);
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

/** `patch` is the public name a match stores ("26.13"); the catalogs are found by the internal one ("16.13"). */
async function storedCatalogForPatch(publicName: string | null, reader: Reader): Promise<DataDragonCatalog | null> {
  const patch = publicName === null ? null : internalPatch(publicName);
  const inMemory = patch === null ? null : fromMemory(patch);
  if (inMemory) return inMemory;
  const stored = await storedVersions(reader);
  const version = patch === null ? newestVersion(stored) : pickStoredVersion(stored, patch);
  if (version === null) return null;
  return loaded.get(version) ?? loadStored(version, reader);
}

/** Picks Champion names from given patch. if none is given from the newest Patch. Admin only: it must see a version an import just stored. */
export async function getChampionNamesForPatch(patch: string | null): Promise<string[]> {
  const catalog = await storedCatalogForPatch(patch, db);
  return catalog ? [...catalog.championNameById.values()].sort((a, b) => a.localeCompare(b)) : [];
}

export interface DisplayCatalog {
  championIconKeys: Record<string, string>;
  itemNames: Record<string, string>;
  runeNames: Record<string, string>;
}

/** The client a read goes through: `db` bypasses the Hyperdrive query cache (an import must see a version it just stored), the public one doesn't. */
type Reader = typeof db;

/** Champion name to Data Dragon's key for its image ("Wukong" → "MonkeyKing"). */
function championIconKeysOf(catalog: DataDragonCatalog): Record<string, string> {
  return Object.fromEntries([...catalog.championNameById].map(([id, name]) => [name, catalog.championKeyById.get(id) ?? name]));
}

/** The icon url of a champion by name, null for one without an icon. Reads only the champions of the newest catalog, through the cached client. */
export async function getChampionIconLookup(): Promise<(championName: string) => string | null> {
  const catalog = await storedCatalogForPatch(null, cachedDb);
  const keys = catalog ? championIconKeysOf(catalog) : {};
  return (championName) => (keys[championName] === undefined ? null : lolIconUrl("champions", keys[championName]));
}

export async function getDisplayCatalog(patch: string | null): Promise<DisplayCatalog> {
  const catalog = await storedCatalogForPatch(patch, cachedDb);
  if (!catalog) return { championIconKeys: {}, itemNames: {}, runeNames: {} };
  return {
    championIconKeys: championIconKeysOf(catalog),
    itemNames: Object.fromEntries([...catalog.itemNameById].map(([id, name]) => [String(id), name])),
    runeNames: catalog.runeNames,
  };
}

async function storedVersions(reader: Reader = db): Promise<string[]> {
  const rows = await reader.select({ version: lolDataDragonCatalogs.version }).from(lolDataDragonCatalogs);
  return rows.map((row) => row.version);
}

async function loadStored(version: string, reader: Reader = db): Promise<DataDragonCatalog | null> {
  const [row] = await reader
    .select({ champions: lolDataDragonCatalogs.champions, items: lolDataDragonCatalogs.items, runes: lolDataDragonCatalogs.runes })
    .from(lolDataDragonCatalogs)
    .where(eq(lolDataDragonCatalogs.version, version));
  return row ? remember(version, row.champions, row.items, row.runes) : null;
}

/**
 * Two imports can race on the same new version, so the second insert does nothing. A failed write only means
 * the next import fetches the version again, so it is logged and not thrown.
 */
async function storeCatalog(version: string, champions: ChampionRecords, items: ItemRecords, runes: RuneRecords | null): Promise<void> {
  try {
    await db.insert(lolDataDragonCatalogs).values({ version, champions, items, runes }).onConflictDoNothing();
  } catch (err) {
    console.warn(`[data-dragon] could not store ${version}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function remember(version: string, champions: ChampionRecords, items: ItemRecords, runes: RuneRecords | null): DataDragonCatalog {
  const catalog: DataDragonCatalog = {
    version,
    championNameById: new Map(Object.entries(champions).map(([id, c]) => [Number(id), c.name])),
    championKeyById: new Map(Object.entries(champions).map(([id, c]) => [Number(id), c.key])),
    itemNameById: new Map(Object.entries(items).map(([id, name]) => [Number(id), name])),
    runeNames: runes ?? {},
  };
  loaded.set(version, catalog);
  return catalog;
}

/** The newest of some versions, by version number. */
function newestVersion(versions: string[]): string | null {
  return [...versions].sort((a, b) => compareVersions(b, a))[0] ?? null;
}

/** Versions whose icons are all stored, as far as this process knows. A synced version never changes back. */
const syncedVersions = new Set<string>();

interface Icon extends DataDragonIconRef {
  kind: LolIconKind;
  /** Edge length in pixels. Champions are larger than everything else. */
  size: number;
  url: string;
}

/** The catalog of the patch (public name, or the newest when null) as stored, then its icons. For pages that show a patch's champions without an import. */
export async function syncIconsOfPatch(patch: string | null): Promise<void> {
  const catalog = await storedCatalogForPatch(patch, db).catch(() => null);
  if (catalog) await syncPatchIcons(catalog.version);
}

/**
 * Stores every icon of a Data Dragon version in the public bucket, once. The version is marked done only when all of
 * its icons are stored, so a patch with a failed icon is tried again by the next request for it. Only one sync runs per
 * version (a lock on the catalog row). Never throws: it runs after the response, and a missing icon only shows a
 * placeholder. Also stores the version's rune names, which the catalog lacked before this sync existed.
 */
export async function syncPatchIcons(version: string): Promise<void> {
  if (syncedVersions.has(version)) return;
  try {
    const [row] = await db.select({ syncedAt: lolDataDragonCatalogs.iconsSyncedAt }).from(lolDataDragonCatalogs).where(eq(lolDataDragonCatalogs.version, version));
    if (!row) return;
    if (row.syncedAt !== null) {
      syncedVersions.add(version);
      return;
    }
    if (!(await takeSyncLock(version))) return;

    let synced = false;
    try {
      synced = await syncIcons(version);
    } finally {
      // A finished sync is marked done; a failed one frees the lock so the next request retries at once.
      await db
        .update(lolDataDragonCatalogs)
        .set({ iconsSyncStartedAt: null, ...(synced ? { iconsSyncedAt: sql`now()` } : {}) })
        .where(eq(lolDataDragonCatalogs.version, version));
    }
    if (synced) syncedVersions.add(version);
  } catch (err) {
    console.warn(`[data-dragon] icon sync of ${version} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** One UPDATE decides which import syncs: only a version that is not done and whose lock is free or expired. */
async function takeSyncLock(version: string): Promise<boolean> {
  const taken = await db
    .update(lolDataDragonCatalogs)
    .set({ iconsSyncStartedAt: sql`now()` })
    .where(
      and(
        eq(lolDataDragonCatalogs.version, version),
        isNull(lolDataDragonCatalogs.iconsSyncedAt),
        or(isNull(lolDataDragonCatalogs.iconsSyncStartedAt), lt(lolDataDragonCatalogs.iconsSyncStartedAt, sql`now() - ${`${ICON_SYNC_LOCK_MINUTES} minutes`}::interval`)),
      ),
    )
    .returning({ version: lolDataDragonCatalogs.version });
  return taken.length > 0;
}

/** Reads the version's files, stores the rune names and uploads the icons not stored yet. True when nothing is missing afterwards. */
async function syncIcons(version: string): Promise<boolean> {
  const base = `${CDN}/${version}/data/${LOCALE}`;
  const [champions, items, spells, runeStyles] = await Promise.all([
    getJson<ChampionFile>(`${base}/champion.json`),
    getJson<ItemFile>(`${base}/item.json`),
    getJson<SummonerFile>(`${base}/summoner.json`),
    getJson<RuneStyleFile[]>(`${base}/runesReforged.json`),
  ]);
  await db.update(lolDataDragonCatalogs).set({ runes: parseRuneNames(runeStyles) }).where(eq(lolDataDragonCatalogs.version, version));

  const wanted = iconsOfVersion(version, champions, items, spells, runeStyles);
  const stored = await db.select({ kind: lolDataDragonIcons.kind, id: lolDataDragonIcons.iconId }).from(lolDataDragonIcons);
  const missing = new Set(missingIcons(wanted, stored).map((icon) => `${icon.kind}/${icon.id}`));
  const toUpload = wanted.filter((icon) => missing.has(`${icon.kind}/${icon.id}`));

  const results = await inIconBatches(toUpload, storeIcon);
  return results.every(Boolean);
}

/** Every icon of the version: all champions, the Summoner's Rift items, all summoner spells and the rune trees and perks. */
function iconsOfVersion(version: string, champions: ChampionFile, items: ItemFile, spells: SummonerFile, runeStyles: RuneStyleFile[]): Icon[] {
  const icons: Icon[] = [];
  for (const champion of Object.values(champions.data)) {
    icons.push({ kind: "champions", id: champion.id, size: 128, url: `${CDN}/${version}/img/champion/${champion.id}.png` });
  }
  for (const id of summonersRiftItemIds(items.data)) icons.push({ kind: "items", id, size: 64, url: `${CDN}/${version}/img/item/${id}.png` });
  // Data Dragon names each spell's image by its own name, so the numeric id comes from the file.
  for (const spell of Object.values(spells.data)) icons.push({ kind: "spells", id: spell.key, size: 64, url: `${CDN}/${version}/img/spell/${spell.image.full}` });
  for (const style of runeStyles) {
    icons.push({ kind: "runes", id: String(style.id), size: 64, url: `${CDN}/img/${style.icon}` });
    for (const slot of style.slots) for (const rune of slot.runes) icons.push({ kind: "runes", id: String(rune.id), size: 64, url: `${CDN}/img/${rune.icon}` });
  }
  return icons;
}

/** Uploads one icon and records it. False when it could not be stored, so the version stays open. */
async function storeIcon(icon: Icon): Promise<boolean> {
  try {
    const response = await fetch(icon.url);
    if (!response.ok) throw new Error(`${icon.url} returned status ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    const webp = await convertToWebp(source, { width: icon.size, height: icon.size, quality: ICON_WEBP_QUALITY, fit: "inside" });
    await putObject(lolIconKey(icon.kind, icon.id), webp, "image/webp");
    await db.insert(lolDataDragonIcons).values({ kind: icon.kind, iconId: icon.id }).onConflictDoNothing();
    return true;
  } catch (err) {
    console.warn(`[data-dragon] could not store ${icon.kind}/${icon.id}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function sourceFailure(err: unknown): null {
  console.warn(`[data-dragon] could not read a Data Dragon file: ${err instanceof Error ? err.message : String(err)}`);
  return null;
}

/** Runs the task for each icon, a batch at a time, so a sync does not open hundreds of requests at once. */
async function inIconBatches<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += ICON_BATCH_SIZE) {
    results.push(...(await Promise.all(items.slice(i, i + ICON_BATCH_SIZE).map(task))));
  }
  return results;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned status ${response.status}`);
  return (await response.json()) as T;
}
