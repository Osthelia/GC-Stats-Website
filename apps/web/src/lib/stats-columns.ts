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

import { championPresence, championWinRate, kdaRatio } from "@gc-stats/lol-stats-engine";
import type { ChampionStatRow, LeagueStatRow, StatRow } from "@/lib/stats-aggregate";

export type StatsMode = "total" | "avg";

export type StatColumnFormat = "int" | "decimal1" | "decimal2" | "percent" | "fraction";

export type StatColumn<Row = StatRow> = {
  key: string;
  /** i18n key under `playerPage`/`teamPage` -> `statsColumns.<i18nKey>` */
  i18nKey: string;
  format: StatColumnFormat;
  defaultVisible: boolean;
  /** true if the column has no meaningful "total" (percentage averages) — total mode falls back to the same value as avg. */
  avgOnly?: boolean;
  /** true if the column is a ratio computed from totals and doesn't change between total/avg mode. */
  modeInvariant?: boolean;
  value: (row: Row, mode: StatsMode) => number;
};

/** A total, or its average per map (per game for LoL). */
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

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** The LoL columns: the same shape as the Valorant ones, over the games of a player. */
export const LEAGUE_STAT_COLUMNS: StatColumn<LeagueStatRow>[] = [
  { key: "played", i18nKey: "playedGames", format: "int", defaultVisible: true, modeInvariant: true, value: (r) => r.mapsPlayed },
  { key: "winRate", i18nKey: "winRate", format: "percent", defaultVisible: false, modeInvariant: true, value: (r) => ratio(r.totals.wins, r.mapsPlayed) * 100 },
  { key: "kills", i18nKey: "kills", format: "decimal1", defaultVisible: true, value: (r, m) => perMap(r.totals.kills, r.mapsPlayed, m) },
  { key: "deaths", i18nKey: "deaths", format: "decimal1", defaultVisible: true, value: (r, m) => perMap(r.totals.deaths, r.mapsPlayed, m) },
  { key: "assists", i18nKey: "assists", format: "decimal1", defaultVisible: true, value: (r, m) => perMap(r.totals.assists, r.mapsPlayed, m) },
  { key: "kda", i18nKey: "kda", format: "decimal2", defaultVisible: true, modeInvariant: true, value: (r) => kdaRatio(r.totals.kills, r.totals.deaths, r.totals.assists) },
  { key: "kp", i18nKey: "kp", format: "percent", defaultVisible: true, modeInvariant: true, value: (r) => ratio(r.totals.kills + r.totals.assists, r.totals.teamKills) * 100 },
  { key: "csPerMinute", i18nKey: "csPerMinute", format: "decimal1", defaultVisible: false, modeInvariant: true, value: (r) => ratio(r.totals.cs, r.totals.minutes) },
  { key: "goldPerMinute", i18nKey: "goldPerMinute", format: "int", defaultVisible: false, modeInvariant: true, value: (r) => ratio(r.totals.gold, r.totals.minutes) },
  { key: "damagePerMinute", i18nKey: "damagePerMinute", format: "int", defaultVisible: false, modeInvariant: true, value: (r) => ratio(r.totals.damage, r.totals.minutes) },
  { key: "visionPerMinute", i18nKey: "visionPerMinute", format: "decimal2", defaultVisible: false, modeInvariant: true, value: (r) => ratio(r.totals.vision, r.totals.minutes) },
  { key: "goldDiff10", i18nKey: "goldDiff10", format: "int", defaultVisible: false, avgOnly: true, value: (r) => r.averages.goldDiff10 },
  { key: "goldDiff15", i18nKey: "goldDiff15", format: "int", defaultVisible: false, avgOnly: true, value: (r) => r.averages.goldDiff15 },
  { key: "xpDiff10", i18nKey: "xpDiff10", format: "int", defaultVisible: false, avgOnly: true, value: (r) => r.averages.xpDiff10 },
  { key: "xpDiff15", i18nKey: "xpDiff15", format: "int", defaultVisible: false, avgOnly: true, value: (r) => r.averages.xpDiff15 },
  { key: "csDiff10", i18nKey: "csDiff10", format: "decimal1", defaultVisible: false, avgOnly: true, value: (r) => r.averages.csDiff10 },
  { key: "csDiff15", i18nKey: "csDiff15", format: "decimal1", defaultVisible: false, avgOnly: true, value: (r) => r.averages.csDiff15 },
];

/** A value only a picked champion has: NaN (shown as "–", sorted last) for a champion that was only banned. */
function whenPicked(row: ChampionStatRow, value: () => number): number {
  return row.totals.picks > 0 ? value() : NaN;
}

export const CHAMPION_STAT_COLUMNS: StatColumn<ChampionStatRow>[] = [
  { key: "picks", i18nKey: "picks", format: "int", defaultVisible: true, modeInvariant: true, value: (r) => r.totals.picks },
  { key: "bans", i18nKey: "bans", format: "int", defaultVisible: true, modeInvariant: true, value: (r) => r.totals.bans },
  { key: "presence", i18nKey: "presence", format: "percent", defaultVisible: true, modeInvariant: true, value: (r) => championPresence(r.totals.picks, r.totals.bans, r.totals.games) },
  { key: "winRate", i18nKey: "winRate", format: "percent", defaultVisible: true, modeInvariant: true, value: (r) => whenPicked(r, () => championWinRate(r.totals.wins, r.totals.picks)) },
  { key: "kills", i18nKey: "kills", format: "decimal1", defaultVisible: false, value: (r, m) => whenPicked(r, () => perMap(r.totals.kills, r.mapsPlayed, m)) },
  { key: "deaths", i18nKey: "deaths", format: "decimal1", defaultVisible: false, value: (r, m) => whenPicked(r, () => perMap(r.totals.deaths, r.mapsPlayed, m)) },
  { key: "assists", i18nKey: "assists", format: "decimal1", defaultVisible: false, value: (r, m) => whenPicked(r, () => perMap(r.totals.assists, r.mapsPlayed, m)) },
  { key: "kda", i18nKey: "kda", format: "decimal2", defaultVisible: true, modeInvariant: true, value: (r) => whenPicked(r, () => kdaRatio(r.totals.kills, r.totals.deaths, r.totals.assists)) },
];

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

/**
 * The columns of one game's stats table. A Client Component takes the key and not the set: the columns hold functions,
 * which can't cross from a Server Component as props.
 */
export type StatColumnSet<Row> = {
  columns: StatColumn<Row>[];
  defaultSort: string;
  /** Columns that depend on the rows, such as one per weapon. */
  rowColumns?: (rows: Row[]) => StatColumn<Row>[];
  /**
   * Translation keys (tournamentPage) of the labels that name game-specific things. Named after the Valorant filters,
   * whose URL names (`agent`, `map`) both games share: LoL filters by champion and role.
   */
  labels: { agentColumn: string; agentFilter: string; agentFilterAll: string; mapFilter: string; mapFilterAll: string };
};

export type StatRowByGame = { valorant: StatRow; lol: LeagueStatRow; lolChampions: ChampionStatRow };

export const STAT_COLUMN_SETS = {
  valorant: {
    columns: STAT_COLUMNS,
    defaultSort: "acs",
    rowColumns: buildWeaponColumns,
    labels: { agentColumn: "statsAgentColumn", agentFilter: "statsFilterAgent", agentFilterAll: "statsFilterAgentAll", mapFilter: "statsFilterMap", mapFilterAll: "statsFilterMapAll" },
  } satisfies StatColumnSet<StatRow>,
  lol: {
    columns: LEAGUE_STAT_COLUMNS,
    defaultSort: "kda",
    labels: { agentColumn: "statsChampionColumn", agentFilter: "statsFilterChampion", agentFilterAll: "statsFilterChampionAll", mapFilter: "statsFilterRole", mapFilterAll: "statsFilterRoleAll" },
  } satisfies StatColumnSet<LeagueStatRow>,
  lolChampions: {
    columns: CHAMPION_STAT_COLUMNS,
    defaultSort: "presence",
    labels: { agentColumn: "statsChampionColumn", agentFilter: "statsFilterChampion", agentFilterAll: "statsFilterChampionAll", mapFilter: "statsFilterRole", mapFilterAll: "statsFilterRoleAll" },
  } satisfies StatColumnSet<ChampionStatRow>,
};

export type StatColumnSetKey = keyof StatRowByGame & keyof typeof STAT_COLUMN_SETS;

export function formatStatValue(value: number, format: StatColumnFormat): string {
  // No value (a LoL champion that was only banned has no K/D/A): Valorant columns never produce NaN.
  if (Number.isNaN(value)) return "–";
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
