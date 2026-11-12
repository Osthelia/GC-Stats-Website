/**
 * GC-Stats — find-games module
 *
 * The pure parts of finding the games of a series: the time window to search, which accounts to start from, and what
 * a found game says about the two teams. The relay calls and the database reads are the caller's. No imports from the
 * web app, so the rules can be tested on their own.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { nameCloseness } from "./account-suggestions";
import { accountsOnRealm, type RiotCluster } from "./match-id";

const HOUR_MS = 3_600_000;

/** The default window around a series' scheduled time. Series start late and run long, so it is wider after. */
export const DEFAULT_HOURS_BEFORE = 1;
export const DEFAULT_HOURS_AFTER = 4;
/** The longest window a search accepts. A wider one finds other series' games, not more of this one. */
export const MAX_WINDOW_HOURS = 48;
/** Accounts to start from per team, the most recently seen first. */
export const SEEDS_PER_TEAM = 2;
/** Games fetched in full per search. */
export const MAX_CANDIDATES = 10;
/** Ids asked for per seed account. More than MAX_CANDIDATES, so a game two seeds share is not cut before it is compared. */
export const SEED_MATCH_COUNT = 30;
/** Under this a game is probably a remake (early surrender before minute 3:30 is a remake; five minutes leaves room). */
export const REMAKE_SECONDS = 300;
/** A name counts as the roster player's when this close (the handle sits inside the Riot name, or the same). */
const NAME_MATCH = 0.9;

export interface SearchWindow {
  start: Date;
  end: Date;
}

/** One hour before to four hours after the scheduled time. Null without one: the admin has to give the window. */
export function defaultSearchWindow(scheduledAt: Date | null): SearchWindow | null {
  if (scheduledAt === null) return null;
  return { start: new Date(scheduledAt.getTime() - DEFAULT_HOURS_BEFORE * HOUR_MS), end: new Date(scheduledAt.getTime() + DEFAULT_HOURS_AFTER * HOUR_MS) };
}

/** Find match ids that exist in all given groups */
export function sharedMatchIds(groups: readonly (readonly (readonly string[])[])[], limit = MAX_CANDIDATES): string[] {
  if (groups.length < 2) return [];
  const sets = groups.map((lists) => new Set(lists.flat()));
  const first = groups[0]!.flat();
  return [...new Set(first)].filter((id) => sets.every((set) => set.has(id))).slice(0, limit);
}

/** True when the window is a real range of at most MAX_WINDOW_HOURS. */
export function isValidSearchWindow(window: SearchWindow): boolean {
  const span = window.end.getTime() - window.start.getTime();
  return Number.isFinite(span) && span > 0 && span <= MAX_WINDOW_HOURS * HOUR_MS;
}

export interface SeedAccountInput {
  puuid: string;
  platform: string | null;
  cluster: string | null;
  lastSeenAt: Date | null;
}

/** The live accounts on the cluster to start the search from: the most recently seen first, at most `limit`. */
export function pickSeedAccounts<T extends SeedAccountInput>(accounts: readonly T[], cluster: RiotCluster, limit = SEEDS_PER_TEAM): T[] {
  return accountsOnRealm(accounts, cluster)
    .sort((a, b) => (b.lastSeenAt?.getTime() ?? -Infinity) - (a.lastSeenAt?.getTime() ?? -Infinity))
    .slice(0, limit);
}

/** Merge multiple lists of matchIds into one list. Ids that appear in more lists come first */
export function mergeMatchIds(lists: readonly (readonly string[])[], limit = MAX_CANDIDATES): string[] {
  const inLists = new Map<string, number>();
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let position = 0; position < longest; position++) {
    for (const list of lists) {
      const id = list[position];
      if (id !== undefined) inLists.set(id, (inLists.get(id) ?? 0) + 1);
    }
  }
  
  return [...inLists.keys()].sort((a, b) => inLists.get(b)! - inLists.get(a)!).slice(0, limit);
}

/** A game this short is flagged: players remake a game that broke at the start. */
export function isPossibleRemake(durationSeconds: number): boolean {
  return durationSeconds < REMAKE_SECONDS;
}

export type FoundSide = "blue" | "red";
export type FoundTeam = "a" | "b";

export interface FoundParticipant {
  puuid: string;
  side: FoundSide;
  /** The Riot name without the tag, for the name check. */
  riotName: string;
}

export interface FoundGameKnowledge {
  accounts: Record<FoundTeam, ReadonlySet<string>>;
  /** The handles and aliases of each team's known people, for when only one team has accounts. */
  names: Record<FoundTeam, readonly string[]>;
}

export interface FoundGameCheck {
  sideOf: Record<FoundTeam, FoundSide | null>;
  known: Record<FoundSide, Record<FoundTeam, number>>;
  players: Record<FoundSide, number>;
  nameMatches: Record<FoundSide, number | null>;
  /** both: each team found on its own side. one: a single team found. none: nothing known, or the teams contradict. */
  status: "both" | "one" | "none";
}

const OTHER_SIDE: Record<FoundSide, FoundSide> = { blue: "red", red: "blue" };
const OTHER_TEAM: Record<FoundTeam, FoundTeam> = { a: "b", b: "a" };

/**
 * Which team plays on which side, from the accounts each team is known to have. A team is on the side holding more of
 * its accounts, if any. When only one team is found, the other side is counted against the other team's roster names
 * ("3 of 5 names match Team B"). Two teams found on the same side contradict each other, so nothing is claimed.
 */
export function checkFoundGame(participants: readonly FoundParticipant[], knowledge: FoundGameKnowledge): FoundGameCheck {
  const known: FoundGameCheck["known"] = { blue: { a: 0, b: 0 }, red: { a: 0, b: 0 } };
  const players: FoundGameCheck["players"] = { blue: 0, red: 0 };
  for (const participant of participants) {
    players[participant.side]++;
    for (const team of ["a", "b"] as const) if (knowledge.accounts[team].has(participant.puuid)) known[participant.side][team]++;
  }

  const sideOf: FoundGameCheck["sideOf"] = { a: null, b: null };
  for (const team of ["a", "b"] as const) {
    const blue = known.blue[team];
    const red = known.red[team];
    if (blue > red) sideOf[team] = "blue";
    else if (red > blue) sideOf[team] = "red";
  }

  const nameMatches: FoundGameCheck["nameMatches"] = { blue: null, red: null };
  if (sideOf.a !== null && sideOf.b !== null) {
    return sideOf.a === sideOf.b ? { sideOf: { a: null, b: null }, known, players, nameMatches, status: "none" } : { sideOf, known, players, nameMatches, status: "both" };
  }
  const foundTeam: FoundTeam | null = sideOf.a !== null ? "a" : sideOf.b !== null ? "b" : null;
  if (foundTeam === null) return { sideOf, known, players, nameMatches, status: "none" };

  const otherTeam = OTHER_TEAM[foundTeam];
  const otherSide = OTHER_SIDE[sideOf[foundTeam]!];
  sideOf[otherTeam] = otherSide;
  nameMatches[otherSide] = participants.filter((p) => p.side === otherSide && knowledge.names[otherTeam].some((name) => nameCloseness(name, p.riotName) >= NAME_MATCH)).length;
  return { sideOf, known, players, nameMatches, status: "one" };
}
