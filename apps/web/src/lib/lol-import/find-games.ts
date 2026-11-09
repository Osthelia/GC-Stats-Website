/**
 * GC-Stats - find-games
 *
 * Finds the games of a series on Riot. Games played with tournament codes show up in the players' match history as
 * type "tourney", so the search starts from the accounts GC Stats already knows for each team (and any Riot ID the
 * admin types), lists their tourney games inside a time window, fetches the games it finds through the relay and checks
 * which team is on which side. Nothing is written: a found game goes through the same preview as any Riot match id.
 * No auth here: the action checks the permission and calls these.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
// adminDb: these reads must see games saved moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { lolGames, lolMatches, lolTournaments } from "@gc-stats/db";
import {
  SEED_MATCH_COUNT,
  accountsOnRealm,
  checkFoundGame,
  clusterForRegion,
  defaultSearchWindow,
  isPossibleRemake,
  isRiotCluster,
  isValidSearchWindow,
  mergeMatchIds,
  parseRiotId,
  pickSeedAccounts,
  sharedMatchIds,
  sideForTeamId,
  type FoundParticipant,
  type FoundSide,
  type FoundTeam,
  type RegionCluster,
  type RiotCluster,
} from "@gc-stats/lol-stats-engine";
import { getLolAccountByRiotId, getLolMatch, getLolTourneyMatchIds, relayProblemKind } from "@/lib/lol-relay-client";
import type { RelayProblemKind } from "@/lib/riot-errors";
import { normalizeRegion } from "@/lib/tournament-regions";
import { findMatchEntrants, knownPeopleOf, loadKnownPeople, type KnownAccount } from "./fetch-league-game";

export type FindGamesError =
  | { kind: "noData" }
  | { kind: "clusterInvalid" }
  | { kind: "windowInvalid" }
  | { kind: "riotIdInvalid"; riotId: string }
  | { kind: "riotIdNotFound"; riotId: string }
  | { kind: "noSeeds" }
  // The relay cannot run the search, with the cause (see relayProblemKind).
  | { kind: RelayProblemKind };

export interface FindGamesBasis {
  /** What the tournament region says about where to search. */
  region: RegionCluster;
  scheduledAt: string | null;
  /** The default window around the scheduled time, null when the series has none. */
  window: { start: string; end: string } | null;
  /** Per team of the series: the known people, and how many of them have a live account on the cluster (null without one). */
  teams: { entrantId: number; name: string; players: number; withAccount: number | null }[];
}

export interface FindGamesInput {
  tournamentId: number;
  matchId: number;
  cluster: string;
  /** ISO instants. */
  start: string;
  end: string;
  /** Riot IDs typed by the admin ("name#tag"). */
  riotIds: string[];
}

export interface FoundGameSide {
  /** The entrant this side is, when the game says it. */
  entrantId: number | null;
  /** Players on this side whose account is known for the entrant. */
  known: number;
  players: number;
  /** When only one team is found: how many names on this side match the other team's roster. */
  nameMatches: number | null;
}

export interface FoundGame {
  riotMatchId: string;
  /** ISO instant. */
  startedAt: string;
  durationSeconds: number;
  status: "both" | "one" | "none";
  sides: Record<FoundSide, FoundGameSide>;
  /** How many of the Riot IDs typed for this search play in the game, out of `typedTotal`. */
  typedMatches: number;
  typedTotal: number;
  /** The game of this or another series that already holds this Riot match, when there is one. */
  imported: { order: number; matchId: number } | null;
  possibleRemake: boolean;
}

export type FindGamesResult = { ok: true; games: FoundGame[] } | { ok: false; error: FindGamesError };

interface TeamKnowledge {
  entrantId: number;
  name: string;
  personIds: number[];
  accounts: KnownAccount[];
  /** Handles and aliases of the known people. */
  names: string[];
}

/** The people known for each team of the series (roster and earlier games), with their Riot accounts and names. */
async function loadTeams(matchId: number): Promise<Record<FoundTeam, TeamKnowledge> | null> {
  const match = await findMatchEntrants(matchId);
  if (!match) return null;
  const [peopleA, peopleB] = await Promise.all([knownPeopleOf(match.entrantAId, null), knownPeopleOf(match.entrantBId, null)]);
  const known = await loadKnownPeople([...peopleA, ...peopleB]);
  const team = (entrantId: number, ids: Set<number>): TeamKnowledge => {
    const people = [...ids].flatMap((id) => known.get(id) ?? []);
    return {
      entrantId,
      name: match.entrants.find((e) => e.id === entrantId)?.name ?? "",
      personIds: [...ids],
      accounts: people.flatMap((person) => person.accounts),
      names: people.flatMap((person) => [person.handle, ...person.aliases]),
    };
  };
  return { a: team(match.entrantAId, peopleA), b: team(match.entrantBId, peopleB) };
}

/** What the search starts from, for the admin to see before searching. `cluster` null: not chosen yet. */
export async function getFindGamesBasis(tournamentId: number, matchId: number, cluster: RiotCluster | null): Promise<FindGamesBasis | null> {
  const [teams, [tournament], [match]] = await Promise.all([
    loadTeams(matchId),
    db.select({ region: lolTournaments.region }).from(lolTournaments).where(eq(lolTournaments.id, tournamentId)).limit(1),
    db.select({ scheduledAt: lolMatches.scheduledAt }).from(lolMatches).where(eq(lolMatches.id, matchId)).limit(1),
  ]);
  if (!teams || !tournament || !match) return null;
  const window = defaultSearchWindow(match.scheduledAt);
  return {
    region: clusterForRegion(normalizeRegion(tournament.region)),
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    window: window && { start: window.start.toISOString(), end: window.end.toISOString() },
    teams: [teams.a, teams.b].map((team) => {
      const withAccountOnCluster = new Set(accountsOnRealm(team.accounts, cluster).map((account) => account.personId));
      return { entrantId: team.entrantId, name: team.name, players: team.personIds.length, withAccount: cluster === null ? null : withAccountOnCluster.size };
    }),
  };
}

export async function findGames(input: FindGamesInput): Promise<FindGamesResult> {
  const cluster = input.cluster;
  if (!isRiotCluster(cluster)) return { ok: false, error: { kind: "clusterInvalid" } };
  const window = { start: new Date(input.start), end: new Date(input.end) };
  if (!isValidSearchWindow(window)) return { ok: false, error: { kind: "windowInvalid" } };
  const typed: { riotId: string; gameName: string; tagLine: string }[] = [];
  for (const riotId of input.riotIds.map((text) => text.trim()).filter((text) => text !== "")) {
    const parsed = parseRiotId(riotId);
    if (!parsed) return { ok: false, error: { kind: "riotIdInvalid", riotId } };
    typed.push({ riotId, ...parsed });
  }
  const teams = await loadTeams(input.matchId);
  if (!teams) return { ok: false, error: { kind: "noData" } };

  // A typo is caught here, before any search: the lookup answers "no such account" at once.
  const typedPuuids: string[] = [];
  for (const entry of typed) {
    const account = await getLolAccountByRiotId(cluster, entry.gameName, entry.tagLine);
    if (!account.ok) return { ok: false, error: account.error.kind === "notFound" ? { kind: "riotIdNotFound", riotId: entry.riotId } : { kind: relayProblemKind(account.error) } };
    typedPuuids.push(account.data.puuid);
  }

  const seedsA = pickSeedAccounts(teams.a.accounts, cluster).map((account) => account.puuid);
  const seedsB = pickSeedAccounts(teams.b.accounts, cluster).map((account) => account.puuid);
  const seeds = [...new Set([...seedsA, ...seedsB, ...typedPuuids])];
  if (seeds.length === 0) return { ok: false, error: { kind: "noSeeds" } };

  const range = { startTime: Math.floor(window.start.getTime() / 1000), endTime: Math.floor(window.end.getTime() / 1000), count: SEED_MATCH_COUNT };
  const lists = await Promise.all(seeds.map((puuid) => getLolTourneyMatchIds(cluster, puuid, range)));
  // A seed Riot refuses (a PUUID issued to another key, say) only drops that account from the search.
  const failures = lists.flatMap((list) => (list.ok ? [] : [list.error]));
  const hardFailure = failures.find((error) => error.kind !== "invalidRequest" && error.kind !== "notFound");
  if (hardFailure && failures.length === lists.length) return { ok: false, error: { kind: relayProblemKind(hardFailure) } };
  const idListOf = new Map(seeds.map((puuid, index) => [puuid, idsOf(lists[index]!)] as const));
  const listsOf = (puuids: string[]) => puuids.flatMap((puuid) => {
    const list = idListOf.get(puuid);
    return list ? [list] : [];
  });
  // The games every typed player and both teams' seed accounts played are the series, so only those are fetched. When
  // there are none (a player used another account, say), everything found is fetched so the admin can still look.
  const groups = [...typedPuuids.map((puuid) => listsOf([puuid])), listsOf(seedsA), listsOf(seedsB)].filter((group) => group.length > 0);
  const shared = sharedMatchIds(groups);
  const ids = shared.length > 0 ? shared : mergeMatchIds([...idListOf.values()].flatMap((list) => (list ? [list] : [])));
  if (ids.length === 0) return { ok: true, games: [] };

  const [matches, stored] = await Promise.all([
    Promise.all(ids.map((id) => getLolMatch(cluster, id))),
    db.select({ apiMatchId: lolGames.apiMatchId, order: lolGames.order, matchId: lolGames.matchId }).from(lolGames).where(inArray(lolGames.apiMatchId, ids)),
  ]);
  const importedBy = new Map(stored.flatMap((game) => (game.apiMatchId ? [[game.apiMatchId, { order: game.order, matchId: game.matchId }] as const] : [])));
  const firstFailure = matches.find((match) => !match.ok);
  if (firstFailure && !firstFailure.ok && matches.every((match) => !match.ok)) return { ok: false, error: { kind: relayProblemKind(firstFailure.error) } };

  const knowledge = {
    accounts: { a: new Set(teams.a.accounts.map((account) => account.puuid)), b: new Set(teams.b.accounts.map((account) => account.puuid)) },
    names: { a: teams.a.names, b: teams.b.names },
  };
  const typedSet = new Set(typedPuuids);
  const games = matches.flatMap((result, index): FoundGame[] => {
    if (!result.ok) return [];
    const info = result.data.info;
    const participants: FoundParticipant[] = info.participants.map((p) => ({ puuid: p.puuid, side: sideForTeamId(p.teamId), riotName: p.riotIdGameName ?? "" }));
    const check = checkFoundGame(participants, knowledge);
    const entrantOf = (side: FoundSide): number | null => (check.sideOf.a === side ? teams.a.entrantId : check.sideOf.b === side ? teams.b.entrantId : null);
    const side = (which: FoundSide): FoundGameSide => ({
      entrantId: entrantOf(which),
      known: Math.max(check.known[which].a, check.known[which].b),
      players: check.players[which],
      nameMatches: check.nameMatches[which],
    });
    return [
      {
        riotMatchId: ids[index]!,
        startedAt: new Date(info.gameCreation).toISOString(),
        durationSeconds: info.gameDuration,
        status: check.status,
        sides: { blue: side("blue"), red: side("red") },
        typedMatches: participants.filter((p) => typedSet.has(p.puuid)).length,
        typedTotal: typedSet.size,
        imported: importedBy.get(ids[index]!) ?? null,
        possibleRemake: isPossibleRemake(info.gameDuration),
      },
    ];
  });
  // Typed Riot IDs are the players of the series, so only the games that hold all of them are shown. When no game does,
  // everything found is kept so the admin can still look.
  const withAllTyped = games.filter((game) => game.typedTotal > 0 && game.typedMatches === game.typedTotal);
  const shown = withAllTyped.length > 0 ? withAllTyped : games;
  // The games with more of the typed IDs first, then by start time.
  shown.sort((a, b) => b.typedMatches - a.typedMatches || a.startedAt.localeCompare(b.startedAt));
  return { ok: true, games: shown };
}


/** The ids of one seed's list, null when Riot refused the seed. */
function idsOf(result: { ok: true; data: string[] } | { ok: false; error: unknown }): string[] | null {
  return result.ok && Array.isArray(result.data) ? result.data : null;
}
