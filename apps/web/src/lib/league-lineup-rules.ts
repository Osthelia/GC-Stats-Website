/**
 * GC-Stats - league-lineup-rules
 *
 * The checks of a League game lineup entered by hand: who played, in which lane, on which champion, optionally the
 * build (summoner spells, runes, items) and optionally the scoreboard. A scoreboard is all or nothing (every player of
 * both teams, and the game length), so a game either has stats or it hasn't; only gold, damage and vision may be left
 * out of it. Every problem names the field it is about, so the editor can mark it. Pure, so the rules can be tested
 * without a database.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { LEAGUE_ROLES, type LeagueRole } from "@gc-stats/lol-stats-engine/lanes";

export const LINEUP_STAT_KEYS = ["kills", "deaths", "assists", "cs", "gold", "damage", "vision"] as const;
export type LineupStatKey = (typeof LINEUP_STAT_KEYS)[number];

/** The numbers a scoreboard can leave out: only the games that have them count for their averages. */
export const LINEUP_OPTIONAL_STATS: ReadonlySet<LineupStatKey> = new Set(["gold", "damage", "vision"]);

/** The highest believable value of each number: a typo with an extra digit is caught, a long game is not. */
export const LINEUP_STAT_MAX: Record<LineupStatKey, number> = { kills: 100, deaths: 100, assists: 100, cs: 2000, gold: 100_000, damage: 500_000, vision: 1000 };

/** The numbers of one player; null for an optional one that is not known. */
export type LeagueLineupStats = Record<LineupStatKey, number | null>;

/** Two summoner spells, six item slots and the trinket (last). */
export const LINEUP_SUMMONER_SLOTS = 2;
export const LINEUP_ITEM_SLOTS = 7;
export const LINEUP_TRINKET_SLOT = LINEUP_ITEM_SLOTS - 1;

/** A player's build, every part optional: null for an empty slot. */
export type LineupBuild = {
  summoners: (number | null)[];
  keystone: number | null;
  secondaryTree: number | null;
  items: (number | null)[];
};

/** A game from 1 minute to 3 hours. */
export const LINEUP_DURATION_MIN_SECONDS = 60;
export const LINEUP_DURATION_MAX_SECONDS = 3 * 60 * 60;

export const LINEUP_HANDLE_MAX_LENGTH = 255;

export type LineupPerson = { id: number } | { newHandle: string };

export type LineupPlayerInput = {
  entrantId: number;
  person: LineupPerson;
  role: LeagueRole;
  championName: string | null;
  stats: LeagueLineupStats | null;
  build: LineupBuild | null;
};

export type LineupInput = { players: LineupPlayerInput[]; durationSeconds: number | null };

/** The field of one lane's row a problem is about. Summoner and item slots carry their index ("item.6" is the trinket). */
export type LineupField = "player" | "champion" | LineupStatKey | `summoner.${number}` | "keystone" | "secondaryTree" | `item.${number}`;

/** Where a problem is: the row (team and lane) and the field in it. */
export type LineupAt = { entrantId: number; role: LeagueRole; field: LineupField };

export type LineupProblem = (
  | { kind: "notAnEntrant" }
  | { kind: "invalidLane" }
  | { kind: "duplicateLane"; role: LeagueRole }
  | { kind: "duplicatePerson" }
  | { kind: "invalidHandle" }
  | { kind: "unknownChampion"; championName: string }
  | { kind: "duplicateChampion"; championName: string }
  | { kind: "championsUnavailable" }
  | { kind: "playerMissing" }
  | { kind: "statMissing" }
  | { kind: "invalidStat"; max: number }
  | { kind: "durationRequired" }
  | { kind: "buildUnavailable" }
  | { kind: "unknownBuildPart" }
  | { kind: "duplicateSummoner" }
  | { kind: "secondaryTreeOfKeystone" }
) & { at?: LineupAt };

/** The summoner spells, runes and items of the game's patch, by id. Null when the patch's files can't be read. */
export type LineupBuildCatalog = {
  summoners: ReadonlySet<number>;
  /** Each keystone with the rune tree it belongs to. */
  keystones: ReadonlyMap<number, number>;
  trees: ReadonlySet<number>;
  items: ReadonlySet<number>;
  trinkets: ReadonlySet<number>;
};

/** True when the lineup has a scoreboard: any player with numbers makes it one, and then every player needs them. */
export function lineupHasStats(input: LineupInput): boolean {
  return input.players.some((player) => player.stats !== null);
}

/** True when the build has anything in it. */
export function buildHasParts(build: LineupBuild | null): boolean {
  return build !== null && (build.summoners.some((id) => id !== null) || build.keystone !== null || build.secondaryTree !== null || build.items.some((id) => id !== null));
}

const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

/** The first thing wrong with a build, null when it is fine. */
function buildProblem(build: LineupBuild, catalog: LineupBuildCatalog | null, at: (field: LineupField) => LineupAt): LineupProblem | null {
  if (!Array.isArray(build.summoners) || build.summoners.length !== LINEUP_SUMMONER_SLOTS) return { kind: "unknownBuildPart", at: at("summoner.0") };
  if (!Array.isArray(build.items) || build.items.length !== LINEUP_ITEM_SLOTS) return { kind: "unknownBuildPart", at: at("item.0") };
  if (!buildHasParts(build)) return null;
  if (catalog === null) {
    const first: LineupField =
      build.summoners[0] !== null ? "summoner.0" : build.summoners[1] !== null ? "summoner.1" : build.keystone !== null ? "keystone" : build.secondaryTree !== null ? "secondaryTree" : `item.${build.items.findIndex((id) => id !== null)}`;
    return { kind: "buildUnavailable", at: at(first) };
  }

  for (const [i, id] of build.summoners.entries()) {
    if (id === null) continue;
    if (!isWhole(id) || !catalog.summoners.has(id)) return { kind: "unknownBuildPart", at: at(`summoner.${i}`) };
    if (build.summoners.indexOf(id) !== i) return { kind: "duplicateSummoner", at: at(`summoner.${i}`) };
  }
  if (build.keystone !== null && (!isWhole(build.keystone) || !catalog.keystones.has(build.keystone))) return { kind: "unknownBuildPart", at: at("keystone") };
  if (build.secondaryTree !== null) {
    if (!isWhole(build.secondaryTree) || !catalog.trees.has(build.secondaryTree)) return { kind: "unknownBuildPart", at: at("secondaryTree") };
    // The secondary tree is the other one: the keystone's own tree can't be taken twice.
    if (build.keystone !== null && catalog.keystones.get(build.keystone) === build.secondaryTree) return { kind: "secondaryTreeOfKeystone", at: at("secondaryTree") };
  }
  for (const [i, id] of build.items.entries()) {
    if (id === null) continue;
    const known = i === LINEUP_TRINKET_SLOT ? catalog.trinkets : catalog.items;
    if (!isWhole(id) || !known.has(id)) return { kind: "unknownBuildPart", at: at(`item.${i}`) };
  }
  return null;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The shape of a lineup received from a client; the values are then checked by `lineupProblem`. */
export function isLineupInput(input: unknown): input is LineupInput {
  if (!isObject(input) || !Array.isArray(input.players)) return false;
  if (input.durationSeconds !== null && typeof input.durationSeconds !== "number") return false;
  return input.players.every((player: unknown) => {
    if (!isObject(player) || !isObject(player.person)) return false;
    if ("newHandle" in player.person ? typeof player.person.newHandle !== "string" : typeof player.person.id !== "number") return false;
    if (player.championName !== null && typeof player.championName !== "string") return false;
    if (player.stats !== null && !isObject(player.stats)) return false;
    return player.build === null || (isObject(player.build) && Array.isArray(player.build.summoners) && Array.isArray(player.build.items));
  });
}

/**
 * The first thing wrong with a lineup, null when it can be saved. `knownChampions` is empty when the patch's champions
 * can't be read, `buildCatalog` null when its summoner spells, runes and items can't.
 */
export function lineupProblem(
  input: LineupInput,
  context: { entrantIds: number[]; knownChampions: ReadonlySet<string>; buildCatalog: LineupBuildCatalog | null },
): LineupProblem | null {
  const lanes = new Set<string>();
  const people = new Set<string>();
  const champions = new Set<string>();

  for (const player of input.players) {
    if (!context.entrantIds.includes(player.entrantId)) return { kind: "notAnEntrant" };
    if (!(LEAGUE_ROLES as readonly string[]).includes(player.role)) return { kind: "invalidLane" };
    const at = (field: LineupField): LineupAt => ({ entrantId: player.entrantId, role: player.role, field });
    // Five lanes per team, each played once, so a team has at most five players.
    const lane = `${player.entrantId}:${player.role}`;
    if (lanes.has(lane)) return { kind: "duplicateLane", role: player.role, at: at("player") };
    lanes.add(lane);

    if ("newHandle" in player.person) {
      const handle = player.person.newHandle.trim();
      if (handle === "" || handle.length > LINEUP_HANDLE_MAX_LENGTH) return { kind: "invalidHandle", at: at("player") };
      // Two new players with the same name are most likely the same player typed twice.
      if (people.has(`new:${handle.toLowerCase()}`)) return { kind: "duplicatePerson", at: at("player") };
      people.add(`new:${handle.toLowerCase()}`);
    } else {
      if (!Number.isInteger(player.person.id) || people.has(`id:${player.person.id}`)) return { kind: "duplicatePerson", at: at("player") };
      people.add(`id:${player.person.id}`);
    }

    if (player.championName !== null) {
      if (context.knownChampions.size === 0) return { kind: "championsUnavailable", at: at("champion") };
      if (!context.knownChampions.has(player.championName)) return { kind: "unknownChampion", championName: player.championName, at: at("champion") };
      if (champions.has(player.championName)) return { kind: "duplicateChampion", championName: player.championName, at: at("champion") };
      champions.add(player.championName);
    }

    if (player.build !== null) {
      const problem = buildProblem(player.build, context.buildCatalog, at);
      if (problem) return problem;
    }
  }

  if (!lineupHasStats(input)) return null;
  // A scoreboard needs both teams complete, or the kill participation and the averages would be wrong.
  for (const entrantId of context.entrantIds) {
    for (const role of LEAGUE_ROLES) {
      if (!input.players.some((player) => player.entrantId === entrantId && player.role === role)) return { kind: "playerMissing", at: { entrantId, role, field: "player" } };
    }
  }
  for (const player of input.players) {
    const at = (field: LineupField): LineupAt => ({ entrantId: player.entrantId, role: player.role, field });
    if (player.stats === null) return { kind: "statMissing", at: at("kills") };
    for (const key of LINEUP_STAT_KEYS) {
      const value = player.stats[key];
      if (value === null) {
        if (LINEUP_OPTIONAL_STATS.has(key)) continue;
        return { kind: "statMissing", at: at(key) };
      }
      if (!isWhole(value) || value < 0 || value > LINEUP_STAT_MAX[key]) return { kind: "invalidStat", max: LINEUP_STAT_MAX[key], at: at(key) };
    }
  }
  const duration = input.durationSeconds;
  if (duration === null || !Number.isInteger(duration) || duration < LINEUP_DURATION_MIN_SECONDS || duration > LINEUP_DURATION_MAX_SECONDS) return { kind: "durationRequired" };
  return null;
}

/** The build as stored: summoners without the empty slots, the items as all seven slots (0 empty, [] for none), and the runes. */
export function storedBuild(build: LineupBuild | null): { summoners: number[]; items: number[]; runes: Record<string, unknown> } {
  if (!buildHasParts(build)) return { summoners: [], items: [], runes: {} };
  const parts = build!;
  return {
    summoners: parts.summoners.filter((id): id is number => id !== null),
    items: parts.items.some((id) => id !== null) ? parts.items.map((id) => id ?? 0) : [],
    // The same keys a Riot rune page has, so the scoreboard reads a manual build like an imported one.
    runes: {
      ...(parts.keystone !== null ? { primaryPerks: [parts.keystone] } : {}),
      ...(parts.secondaryTree !== null ? { subStyle: parts.secondaryTree } : {}),
    },
  };
}

/** A stored build back as slots: for the editor, from what storedBuild wrote (or an import). */
export function buildFromStored(summoners: unknown, items: unknown, runes: unknown): LineupBuild | null {
  const ids = (value: unknown): number[] => (Array.isArray(value) ? value.filter(isWhole) : []);
  const spells = ids(summoners);
  const slots = ids(items);
  const page = runes as { primaryPerks?: unknown; subStyle?: unknown } | null;
  const keystone = Array.isArray(page?.primaryPerks) && isWhole(page.primaryPerks[0]) ? page.primaryPerks[0] : null;
  const secondaryTree = isWhole(page?.subStyle) ? page.subStyle : null;
  const build: LineupBuild = {
    summoners: Array.from({ length: LINEUP_SUMMONER_SLOTS }, (_, i) => spells[i] ?? null),
    keystone,
    secondaryTree,
    items: Array.from({ length: LINEUP_ITEM_SLOTS }, (_, i) => (slots[i] === undefined || slots[i] === 0 ? null : slots[i]!)),
  };
  return buildHasParts(build) ? build : null;
}
