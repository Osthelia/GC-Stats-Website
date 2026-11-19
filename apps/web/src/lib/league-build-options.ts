/**
 * GC-Stats - league-build-options
 *
 * What a build entered by hand can be made of, read from a Data Dragon version's files: the summoner spells of the
 * normal Summoner's Rift game, the keystones and rune trees, the items and the trinkets. Pure, so it can be tested
 * without Data Dragon; data-dragon-client reads the files.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { LineupBuildCatalog } from "@/lib/league-lineup-rules";

export interface BuildOption {
  id: number;
  name: string;
}

export interface LeagueBuildOptions {
  summoners: BuildOption[];
  /** Each keystone with the id of its rune tree, so the editor can keep the secondary tree a different one. */
  keystones: (BuildOption & { treeId: number })[];
  trees: BuildOption[];
  items: BuildOption[];
  trinkets: BuildOption[];
}

/** The parts of item.json, summoner.json and runesReforged.json the options are made from. */
export interface BuildOptionFiles {
  items: { data: Record<string, { name: string; tags?: string[]; maps?: Record<string, boolean> }> };
  summoners: { data: Record<string, { key: string; name: string; modes?: string[] }> };
  runeStyles: { id: number; name: string; slots: { runes: { id: number; name: string }[] }[] }[];
}

/** Data Dragon's map id for Summoner's Rift, and the game mode of a normal (and tournament) game on it. */
const SUMMONERS_RIFT = "11";
const CLASSIC_MODE = "CLASSIC";

const byName = (a: BuildOption, b: BuildOption) => a.name.localeCompare(b.name);

/**
 * The options of one version. Items are the Summoner's Rift ones; an item listed under several ids with the same
 * name (map or mode variants) is offered once, by its lowest id.
 */
export function buildOptionsOf(files: BuildOptionFiles): LeagueBuildOptions {
  const items = new Map<string, BuildOption>();
  const trinkets = new Map<string, BuildOption>();
  const ids = Object.keys(files.items.data)
    .filter((key) => Number.isInteger(Number(key)))
    .sort((a, b) => Number(a) - Number(b));
  for (const key of ids) {
    const item = files.items.data[key]!;
    if (item.maps?.[SUMMONERS_RIFT] !== true) continue;
    const list = item.tags?.includes("Trinket") ? trinkets : items;
    if (!list.has(item.name)) list.set(item.name, { id: Number(key), name: item.name });
  }

  const summoners = Object.values(files.summoners.data)
    .filter((spell) => Number.isInteger(Number(spell.key)) && (spell.modes?.includes(CLASSIC_MODE) ?? false))
    .map((spell) => ({ id: Number(spell.key), name: spell.name }));

  const trees = files.runeStyles.map((style) => ({ id: style.id, name: style.name }));
  const keystones = files.runeStyles.flatMap((style) => (style.slots[0]?.runes ?? []).map((rune) => ({ id: rune.id, name: rune.name, treeId: style.id })));

  return {
    summoners: summoners.sort(byName),
    keystones: keystones.sort(byName),
    trees: trees.sort(byName),
    items: [...items.values()].sort(byName),
    trinkets: [...trinkets.values()].sort(byName),
  };
}

/** The options as the sets the lineup rules check a build against. */
export function buildCatalogOf(options: LeagueBuildOptions): LineupBuildCatalog {
  return {
    summoners: new Set(options.summoners.map((option) => option.id)),
    keystones: new Map(options.keystones.map((option) => [option.id, option.treeId])),
    trees: new Set(options.trees.map((option) => option.id)),
    items: new Set(options.items.map((option) => option.id)),
    trinkets: new Set(options.trinkets.map((option) => option.id)),
  };
}
