/**
 * GC-Stats - stats-columns
 *
 * Column definitions for the player/team stats tables: per-column format,
 * default visibility, and how to compute its value in total or average
 * mode. Mirrors V1's base column list, plus dynamic per-weapon columns.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { StatRow } from "@/lib/stats-aggregate";

export type StatsMode = "total" | "avg";

export type StatColumnFormat = "int" | "decimal1" | "decimal2" | "percent" | "fraction";

export type StatColumn = {
  key: string;
  /** i18n key under `playerPage`/`teamPage` -> `statsColumns.<i18nKey>` */
  i18nKey: string;
  format: StatColumnFormat;
  defaultVisible: boolean;
  /** true if the column has no meaningful "total" (percentage averages) — total mode falls back to the same value as avg. */
  avgOnly?: boolean;
  /** true if the column is a ratio computed from totals and doesn't change between total/avg mode. */
  modeInvariant?: boolean;
  value: (row: StatRow, mode: StatsMode) => number;
};

function perMap(total: number, mapsPlayed: number, mode: StatsMode): number {
  if (mode === "total") return total;
  return mapsPlayed > 0 ? total / mapsPlayed : 0;
}

/** Ordered base column list — mirrors V1's `baseCols` (player/team stats.blade.php), minus `plants`/`defuses` (no per-player data in the V2 schema). */
export const STAT_COLUMNS: StatColumn[] = [
  { key: "played", i18nKey: "played", format: "int", defaultVisible: true, modeInvariant: true, value: (r) => r.mapsPlayed },
  { key: "roundsPlayed", i18nKey: "roundsPlayed", format: "int", defaultVisible: true, modeInvariant: true, value: (r) => r.roundsPlayed },
  { key: "acs", i18nKey: "acs", format: "int", defaultVisible: true, value: (r, m) => perMap(r.totals.acs, r.mapsPlayed, m) },
  { key: "kills", i18nKey: "kills", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.kills, r.mapsPlayed, m) },
  { key: "deaths", i18nKey: "deaths", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.deaths, r.mapsPlayed, m) },
  { key: "assists", i18nKey: "assists", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.assists, r.mapsPlayed, m) },
  { key: "kd", i18nKey: "kd", format: "decimal2", defaultVisible: true, modeInvariant: true, value: (r) => (r.totals.deaths > 0 ? r.totals.kills / r.totals.deaths : r.totals.kills) },
  {
    key: "kda",
    i18nKey: "kda",
    format: "decimal2",
    defaultVisible: true,
    modeInvariant: true,
    value: (r) => (r.totals.deaths > 0 ? (r.totals.kills + r.totals.assists) / r.totals.deaths : r.totals.kills + r.totals.assists),
  },
  { key: "adr", i18nKey: "adr", format: "int", defaultVisible: true, value: (r, m) => perMap(r.totals.adr, r.mapsPlayed, m) },
  { key: "kast", i18nKey: "kast", format: "percent", defaultVisible: true, avgOnly: true, value: (r) => (r.mapsPlayed > 0 ? r.totals.kastPercentage / r.mapsPlayed : 0) },
  { key: "firstKills", i18nKey: "firstKills", format: "decimal1", defaultVisible: true, value: (r, m) => perMap(r.totals.firstKills, r.mapsPlayed, m) },
  { key: "firstDeaths", i18nKey: "firstDeaths", format: "decimal1", defaultVisible: true, value: (r, m) => perMap(r.totals.firstDeaths, r.mapsPlayed, m) },
  { key: "hs", i18nKey: "hs", format: "percent", defaultVisible: true, avgOnly: true, value: (r) => (r.mapsPlayed > 0 ? r.totals.headshotPercentage / r.mapsPlayed : 0) },
  { key: "ability1Kills", i18nKey: "ability1Kills", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.ability1Kills, r.mapsPlayed, m) },
  { key: "ability2Kills", i18nKey: "ability2Kills", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.ability2Kills, r.mapsPlayed, m) },
  { key: "grenadeKills", i18nKey: "grenadeKills", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.grenadeKills, r.mapsPlayed, m) },
  { key: "ultimateKills", i18nKey: "ultimateKills", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.ultimateKills, r.mapsPlayed, m) },
  { key: "fallDeaths", i18nKey: "fallDeaths", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.fallDeaths, r.mapsPlayed, m) },
  { key: "multi2k", i18nKey: "multi2k", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.multi2k, r.mapsPlayed, m) },
  { key: "multi3k", i18nKey: "multi3k", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.multi3k, r.mapsPlayed, m) },
  { key: "multi4k", i18nKey: "multi4k", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.multi4k, r.mapsPlayed, m) },
  { key: "multi5k", i18nKey: "multi5k", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.multi5k, r.mapsPlayed, m) },
  {
    key: "clutches",
    i18nKey: "clutches",
    format: "fraction",
    defaultVisible: false,
    modeInvariant: true,
    value: (r) => r.totals.clutchesWon,
  },
  { key: "tradeKills", i18nKey: "tradeKills", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.tradeKills, r.mapsPlayed, m) },
  { key: "tradedDeaths", i18nKey: "tradedDeaths", format: "decimal1", defaultVisible: false, value: (r, m) => perMap(r.totals.tradedDeaths, r.mapsPlayed, m) },
];

export const DEFAULT_VISIBLE_COLUMNS = STAT_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

/** Clutch column needs both won and played to render "won/played" — not expressible through the generic numeric `value()`. */
export function clutchFraction(row: StatRow): { won: number; played: number } {
  return { won: row.totals.clutchesWon, played: row.totals.clutchesPlayed };
}

export function weaponColumnKey(weapon: string): string {
  return `weapon_${weapon}`;
}

export function weaponNameFromColumnKey(key: string): string {
  return key.slice("weapon_".length);
}

/** Dynamic weapon columns — one per weapon actually present across the current (already filtered) rows, sorted by total kills desc like V1. */
export function buildWeaponColumns(rows: StatRow[]): StatColumn[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const [weapon, n] of Object.entries(row.weaponKills)) {
      totals.set(weapon, (totals.get(weapon) ?? 0) + n);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([weapon]) => ({
      key: weaponColumnKey(weapon),
      i18nKey: "",
      format: "decimal1" as const,
      defaultVisible: false,
      value: (r: StatRow, m: StatsMode) => perMap(r.weaponKills[weapon] ?? 0, r.mapsPlayed, m),
    }));
}

export function formatStatValue(value: number, format: StatColumnFormat): string {
  switch (format) {
    case "int":
      return String(Math.round(value));
    case "decimal1":
      return value.toFixed(1);
    case "decimal2":
      return value.toFixed(2);
    case "percent":
      return `${value.toFixed(1)}%`;
    default:
      return String(value);
  }
}
