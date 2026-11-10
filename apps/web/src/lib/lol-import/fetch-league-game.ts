/**
 * GC-Stats - fetch-league-game
 *
 * One game in two steps, from a Leaguepedia list entry or a Riot match id. `prepare` loads the game (bucket or
 * its source), checks it, keeps
 * the raw pair in the bucket and returns a preview: teams, winner, players, champions, and the entrant
 * sides suggested from the linked players or the team names. Nothing else is written. `commit` takes the
 * admin's choices (which person each unknown Riot account is, and which entrant is blue and red), writes
 * the Riot account links with conflict handling, stores the game through importGame, and remembers which team each
 * Leaguepedia team name stands for, for the side suggestions of later imports. No auth here: the actions
 * check the permission and call these.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
// adminDb: these reads must see writes made moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { lolEntrants, lolGamePlayerStats, lolGames, lolLeaguepediaGames, lolLeaguepediaTeamNames, lolMatches, lolPeople, lolPersonAccounts, lolRosterMembershipLanes, lolRosterMemberships, lolTeams } from "@gc-stats/db";
import {
  accountRealm,
  assignedRoles,
  championNameOf,
  clusterForPlatform,
  formatRiotId,
  inferRoles,
  isTournamentRealm,
  LEAGUE_ROLES,
  missingChampionIds,
  platformOfMatchId,
  rankSuggestions,
  resolvePlayerRoles,
  riotCluster,
  sideForTeamId,
  sortLanes,
  type SuggestionCandidate,
  validateImport,
  type LeagueSide,
  type RiotMatchDto,
} from "@gc-stats/lol-stats-engine";
import { storeLolImport, readLolImport, type LolImportPayload } from "@gc-stats/storage";
import { getChampionCatalog } from "@/lib/data-dragon-client";
import { getLolMatch, getLolTimeline, relayProblem, renewLolMatch, renewLolTimeline } from "@/lib/lol-relay-client";
import type { RelayProblem } from "@/lib/riot-errors";
import type { RiotRelayError } from "@/lib/riot-relay-transport";
import { createPerson, ensureGameProfile, type PersonWriteClient } from "@/lib/person-service";
import { getEntrantPersonIds } from "@/lib/map-fetch/identity-resolution";
import { compareTeamNames } from "@/lib/liquipedia-team-match";
import { accountHolder, insertAccount, isAccountTaken } from "@/lib/lol-accounts";
import { importGame } from "./import-game";
import { loadLeaguepediaGame } from "./leaguepedia-game";

/** fetch: the bucket, or the source (Leaguepedia, Riot) when the game is not there. renew: the source, always. reprocess: the bucket only. */
export type GameLoadMode = "fetch" | "renew" | "reprocess";

/** Where a game comes from: a Leaguepedia list entry, or a Riot match id that RiotRelay serves. */
export type GameRef = { source: "leaguepedia"; leaguepediaGameId: string } | { source: "riot"; riotMatchId: string };

export type GameImportError =
  | { kind: "noData" }
  | { kind: "notInBucket" }
  | { kind: "pageInvalid" }
  | { kind: "fetch" }
  | { kind: "missingConfig" }
  | { kind: "invalidOrder" }
  | { kind: "sidesUnresolved" }
  | { kind: "sidesInvalid" }
  | { kind: "roleInvalid" }
  | { kind: "orderTaken"; order: number }
  | { kind: "missingPlayers"; count: number }
  | { kind: "accountConflict"; puuid: string }
  | { kind: "duplicateAccount" }
  | { kind: "invalidUpload"; errors: string[] }
  | { kind: "dataDragonUnavailable" }
  | { kind: "unknownChampions"; ids: number[] }
  | { kind: "storageUnavailable" }
  | RelayProblem
  | { kind: "tournamentRealm" }
  | { kind: "storeFailed"; message: string };

export interface PreviewPlayer {
  puuid: string;
  riotId: string;
  side: LeagueSide;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  person: PersonRef | null;
  role: string | null;
  assignedRole: string | null;
  /** Only a check: the preview shows it when it differs the assignedRole. */
  positionRole: string | null;
  /** Accounts that could be the player. */
  suggestions: Record<number, PersonRef[]>;
}

export interface PersonRef {
  id: number;
  handle: string;
}

export interface GamePreview {
  game: GameRef;
  mode: GameLoadMode;
  riotMatchId: string;
  /** The platform the game was played on ("EUW1", or "LOLTMNT01" for the tournament realm) and the realm it makes. */
  platform: string;
  realm: "live" | "tournament";
  teams: { blue: string | null; red: string | null };
  winner: LeagueSide | null;
  durationSeconds: number;
  entrants: { id: number; name: string }[];
  /** Blue and red as entrants of this series, when they can be told apart. */
  suggestedSides: Record<LeagueSide, number> | null;
  suggestionFrom: "players" | "names" | null;
  players: PreviewPlayer[];
  /** The overrides already kept on this game, by puuid. */
  roleOverrides: Record<string, string | null>;
}

export type PrepareResult = { ok: true; preview: GamePreview } | { ok: false; error: GameImportError };

export interface PrepareInput {
  tournamentId: number;
  matchId: number;
  game: GameRef;
  mode: GameLoadMode;
  /** The stored game being replaced, null when a new game is created. Its stored players say nothing about the sides. */
  gameId: number | null;
}

/** One unknown Riot account: link it to an existing person, or create a person for it. */
export interface PlayerMapping {
  puuid: string;
  personId: number | null;
  createHandle: string | null;
}

export interface CommitInput {
  /** How the game was loaded, for the activity log. */
  mode: GameLoadMode;
  tournamentId: number;
  matchId: number;
  /** The game being edited, null when a new game is created. */
  gameId: number | null;
  game: GameRef;
  order: number;
  entrantIdBySide: Record<LeagueSide, number>;
  mappings: PlayerMapping[];
  /** The admin's role overrides by puuid, only where the role differs from the inferred one. */
  roleOverrides: Record<string, string | null>;
}

export type CommitResult = { ok: true; gameId: number } | { ok: false; error: GameImportError };

export async function prepareGame(input: PrepareInput): Promise<PrepareResult> {
  const resolved = await resolveGame(input.tournamentId, input.game);
  if (!resolved) return { ok: false, error: { kind: "noData" } };

  const match = await findMatchEntrants(input.matchId);
  if (!match) return { ok: false, error: { kind: "sidesUnresolved" } };

  const loaded = await loadGame(resolved.riotMatchId, input.game, input.mode);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const validation = validateImport(loaded.payload.match, loaded.payload.timeline);
  if (!validation.ok) return { ok: false, error: { kind: "invalidUpload", errors: validation.errors } };

  // The raw pair is kept before anything else, so the commit can read it back without asking the source again.
  if (!loaded.fromBucket) {
    try {
      await storeLolImport(input.game.source, resolved.riotMatchId, { match: validation.match, timeline: validation.timeline });
    } catch (err) {
      console.error(`[${input.game.source}] could not store game ${resolved.riotMatchId} in the imports bucket`, err);
      return { ok: false, error: { kind: "storageUnavailable" } };
    }
  }

  // The preview shows champion names, so a game the catalog cannot name is refused here, before anyone links players to it.
  const names = await getChampionCatalog(validation.match.info.gameVersion);
  if (!names.ok) return { ok: false, error: { kind: "dataDragonUnavailable" } };
  const catalog = names.catalog;
  const missing = missingChampionIds(validation.match, catalog.championNameById);
  if (missing.length > 0) return { ok: false, error: { kind: "unknownChampions", ids: missing } };
  const riotMatch = validation.match;
  const roleOverrides = await savedRoleOverrides(resolved.riotMatchId);
  const assigned = assignedRoles(riotMatch);
  const inferred = inferRoles(riotMatch, validation.timeline);
  const effective = resolvePlayerRoles(riotMatch, roleOverrides);
  const puuids = riotMatch.info.participants.map((p) => p.puuid);
  const linked = await linkedPeopleByPuuid(puuids);

  const [peopleA, peopleB] = await Promise.all([knownPeopleOf(match.entrantAId, input.gameId), knownPeopleOf(match.entrantBId, input.gameId)]);
  const entrantNames = new Map(match.entrants.map((e) => [e.id, e.name]));
  const suggestion = suggestSides({ blue: resolved.blue, red: resolved.red }, riotMatch, linked, peopleA, peopleB, match.entrants, {
    a: match.entrantAId,
    b: match.entrantBId,
  });
  const platform = gamePlatform(riotMatch, resolved.riotMatchId);
  const candidates = await suggestionCandidates(new Map([[match.entrantAId, peopleA], [match.entrantBId, peopleB]]), new Set([...linked.values()].map((person) => person.id)));

  const winnerTeam = riotMatch.info.teams.find((t) => t.win);
  return {
    ok: true,
    preview: {
      game: input.game,
      mode: input.mode,
      riotMatchId: resolved.riotMatchId,
      platform,
      realm: accountRealm(platform),
      teams: { blue: resolved.blue, red: resolved.red },
      winner: winnerTeam ? sideForTeamId(winnerTeam.teamId) : null,
      durationSeconds: riotMatch.info.gameDuration,
      entrants: [match.entrantAId, match.entrantBId].map((id) => ({ id, name: entrantNames.get(id) ?? "" })),
      suggestedSides: suggestion?.sides ?? null,
      suggestionFrom: suggestion?.from ?? null,
      players: riotMatch.info.participants.map((p) => {
        const person = linked.get(p.puuid) ?? null;
        return {
          puuid: p.puuid,
          riotId: formatRiotId(p) ?? p.puuid.slice(0, 8),
          side: sideForTeamId(p.teamId),
          role: effective.get(p.participantId) ?? null,
          assignedRole: assigned.get(p.participantId) ?? null,
          positionRole: inferred?.get(p.participantId) ?? null,
          championName: championNameOf(catalog.championNameById, p.championId),
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          person: person ? { id: person.id, handle: person.handle } : null,
          suggestions: person ? {} : suggestionsFor(p, effective.get(p.participantId) ?? null, candidates),
        };
      }),
      roleOverrides,
    },
  };
}

export async function commitGame(input: CommitInput): Promise<CommitResult> {
  if (!Number.isInteger(input.order) || input.order < 1) return { ok: false, error: { kind: "invalidOrder" } };

  const resolved = await resolveGame(input.tournamentId, input.game);
  if (!resolved) return { ok: false, error: { kind: "noData" } };

  const match = await findMatchEntrants(input.matchId);
  if (!match) return { ok: false, error: { kind: "sidesUnresolved" } };
  const { blue, red } = input.entrantIdBySide;
  const entrantIds = new Set([match.entrantAId, match.entrantBId]);
  if (blue === red || !entrantIds.has(blue) || !entrantIds.has(red)) return { ok: false, error: { kind: "sidesInvalid" } };

  let stored: LolImportPayload | null;
  try {
    stored = await readLolImport(input.game.source, resolved.riotMatchId);
  } catch (err) {
    console.error(`[${input.game.source}] could not read game ${resolved.riotMatchId} from the imports bucket`, err);
    return { ok: false, error: { kind: "storageUnavailable" } };
  }
  if (!stored) return { ok: false, error: { kind: "notInBucket" } };
  const validation = validateImport(stored.match, stored.timeline);
  if (!validation.ok) return { ok: false, error: { kind: "invalidUpload", errors: validation.errors } };
  // The game number is taken by another game of the series: the store would insert a second one and fail on the unique key.
  const [taken] = await db.select({ id: lolGames.id, apiMatchId: lolGames.apiMatchId }).from(lolGames).where(and(eq(lolGames.matchId, input.matchId), eq(lolGames.order, input.order))).limit(1);
  if (taken && taken.id !== input.gameId && taken.apiMatchId !== validation.match.metadata.matchId) return { ok: false, error: { kind: "orderTaken", order: input.order } };

  const playerPuuids = new Set(validation.match.info.participants.map((p) => p.puuid));
  for (const [puuid, role] of Object.entries(input.roleOverrides)) {
    if (!playerPuuids.has(puuid) || (role !== null && !(LEAGUE_ROLES as readonly string[]).includes(role))) return { ok: false, error: { kind: "roleInvalid" } };
  }

  const puuids = validation.match.info.participants.map((p) => p.puuid);
  const linked = await linkedPeopleByPuuid(puuids);
  const mappingByPuuid = new Map(input.mappings.map((m) => [m.puuid, m]));
  const unmapped = puuids.filter((puuid) => !linked.has(puuid) && !isMapped(mappingByPuuid.get(puuid)));
  if (unmapped.length > 0) return { ok: false, error: { kind: "missingPlayers", count: unmapped.length } };

  // The same account twice in one save would race its own link, so it is refused before anything is written.
  if (new Set(input.mappings.map((m) => m.puuid)).size !== input.mappings.length) return { ok: false, error: { kind: "duplicateAccount" } };

  const platform = gamePlatform(validation.match, resolved.riotMatchId);
  const seenAt = new Date(validation.match.info.gameCreation);
  const linkPeople = async (tx: PersonWriteClient): Promise<Map<string, number>> => {
    const personIdByPuuid = new Map<string, number>();
    for (const participant of validation.match.info.participants) {
      const known = linked.get(participant.puuid);
      // A mapping for an account that is already linked is ignored: the link is not the admin's to move.
      if (known) {
        personIdByPuuid.set(participant.puuid, known.id);
        continue;
      }
      const mapping = mappingByPuuid.get(participant.puuid);
      if (!mapping) continue;
      personIdByPuuid.set(participant.puuid, await linkAccount(tx, mapping, { platform, riotId: formatRiotId(participant), seenAt, source: input.game.source }));
    }
    return personIdByPuuid;
  };
  try {
    const stored = await importGame({
      matchId: input.matchId,
      order: input.order,
      match: validation.match,
      timeline: validation.timeline,
      source: input.game.source,
      entrantIdBySide: input.entrantIdBySide,
      personIdByPuuid: linkPeople,
      roleOverrides: input.roleOverrides,
      replaceGameId: input.gameId,
      rawStored: true,
    });
    if (!stored.ok) return { ok: false, error: stored.error };
    await rememberLeaguepediaTeamNames({ blue: resolved.blue, red: resolved.red }, match.entrants, input.entrantIdBySide);
    await refreshAccounts(validation.match, platform, seenAt);
    return { ok: true, gameId: stored.gameId };
  } catch (err) {
    if (err instanceof AccountConflictError) return { ok: false, error: { kind: "accountConflict", puuid: err.puuid } };
    console.error(`[leaguepedia] storing game ${input.order} of match #${input.matchId} failed`, err);
    return { ok: false, error: { kind: "storeFailed", message: describeStoreError(err) } };
  }
}

/**
 * The database's reason, not Drizzle's wrapper: the code and constraint name, then the detail (for example the
 * key that already exists). Falls back to the message when there is no database error underneath.
 */
export function describeStoreError(err: unknown): string {
  const cause = (err as { cause?: { code?: string; constraint?: string; detail?: string; message?: string } } | null)?.cause;
  const parts = [cause?.code, cause?.constraint, cause?.detail ?? cause?.message].filter((part): part is string => Boolean(part));
  if (parts.length > 0) return parts.join(" · ");
  return err instanceof Error ? err.message : String(err);
}

/** The role overrides already kept on the game, so a preview starts from what the game has. */
async function savedRoleOverrides(riotMatchId: string): Promise<Record<string, string | null>> {
  const [game] = await db.select({ roleOverrides: lolGames.roleOverrides }).from(lolGames).where(eq(lolGames.apiMatchId, riotMatchId)).limit(1);
  return game?.roleOverrides ?? {};
}

function isMapped(mapping: PlayerMapping | undefined): boolean {
  return mapping !== undefined && (mapping.personId !== null || (mapping.createHandle ?? "").trim() !== "");
}

/** What a game says about one Riot account, as it is stored on the account. */
interface AccountSighting {
  platform: string;
  /** "name#tag", null when the game does not carry it. */
  riotId: string | null;
  /** When the game started. */
  seenAt: Date;
  source: "leaguepedia" | "riot";
}

/** The platform a game was played on. The match id says it for the tournament realm too ("LOLTMNT01_..."). */
function gamePlatform(match: RiotMatchDto, riotMatchId: string): string {
  return platformOfMatchId(riotMatchId) ?? match.info.platformId;
}

/** An account another person holds: thrown inside the store transaction so it rolls back. */
class AccountConflictError extends Error {
  constructor(readonly puuid: string) {
    super(`Account ${puuid} could not be linked`);
  }
}

/**
 * Links one Riot account to a person, or creates the person with it, and returns the person. A known person with a new
 * account gets it added next to the ones they have. An account that another person already holds is never moved:
 * that throws AccountConflictError, which aborts the transaction it runs in. Runs on the store transaction, so the
 * writes only stay when the game is stored.
 */
async function linkAccount(tx: PersonWriteClient, mapping: PlayerMapping, sighting: AccountSighting): Promise<number> {
  const holder = await accountHolder(mapping.puuid, tx);
  const values = {
    puuid: mapping.puuid,
    platform: sighting.platform,
    cluster: clusterForPlatform(sighting.platform),
    riotId: sighting.riotId,
    source: sighting.source,
    lastSeenAt: sighting.seenAt,
  };
  try {
    if (mapping.personId !== null) {
      if (holder) {
        if (holder.personId === mapping.personId) return holder.personId;
        throw new AccountConflictError(mapping.puuid);
      }
      await ensureGameProfile(tx, "lol", mapping.personId);
      await insertAccount(tx, { ...values, personId: mapping.personId });
      return mapping.personId;
    }
    if (holder) throw new AccountConflictError(mapping.puuid);
    const personId = await createPerson(tx, "lol", { handle: (mapping.createHandle ?? "").trim() });
    await insertAccount(tx, { ...values, personId });
    return personId;
  } catch (err) {
    // The primary key on puuid catches a concurrent link of the same account. Anything else (a dropped connection, a
    // failed check) is a real failure and surfaces as one.
    if (isAccountTaken(err)) throw new AccountConflictError(mapping.puuid);
    throw err;
  }
}

/**
 * After a game is stored: the platform, cluster, Riot ID and last seen time of every linked account in it. A game older
 * than the last one seen only fills what is still empty, so importing an old game does not turn an account back.
 */
async function refreshAccounts(match: RiotMatchDto, platform: string, seenAt: Date): Promise<void> {
  const a = lolPersonAccounts;
  const cluster = clusterForPlatform(platform);
  const seen = sql`${seenAt.toISOString()}::timestamptz`;
  const isNewest = sql`(${a.lastSeenAt} IS NULL OR ${a.lastSeenAt} <= ${seen})`;
  const participants = sql.join(match.info.participants.map((participant) => sql`(${participant.puuid}::text, ${formatRiotId(participant)}::text)`), sql`, `);
  try {
    await db
      .update(a)
      .set({
        platform: sql`CASE WHEN ${isNewest} THEN ${platform}::text ELSE COALESCE(${a.platform}, ${platform}::text) END`,
        cluster: sql`CASE WHEN ${isNewest} THEN ${cluster}::text ELSE COALESCE(${a.cluster}, ${cluster}::text) END`,
        riotId: sql`CASE WHEN v.riot_id IS NULL THEN ${a.riotId} WHEN ${isNewest} THEN v.riot_id ELSE COALESCE(${a.riotId}, v.riot_id) END`,
        lastSeenAt: sql`GREATEST(${a.lastSeenAt}, ${seen})`,
      })
      .from(sql`(VALUES ${participants}) AS v(puuid, riot_id)`)
      .where(sql`${a.puuid} = v.puuid`);
  } catch (err) {
    // The game is stored; a stale Riot ID is not worth failing the save for.
    console.error(`[leaguepedia] could not refresh the accounts of game ${match.metadata.matchId}`, err);
  }
}

async function findListedGame(tournamentId: number, leaguepediaGameId: string) {
  const [listed] = await db
    .select()
    .from(lolLeaguepediaGames)
    .where(and(eq(lolLeaguepediaGames.leaguepediaGameId, leaguepediaGameId), eq(lolLeaguepediaGames.tournamentId, tournamentId)))
    .limit(1);
  if (!listed || !listed.hasData || !listed.riotMatchId) return null;
  return { ...listed, riotMatchId: listed.riotMatchId };
}

/** The Riot match id and the team names of a game. A Riot game has no list entry, so it has no team names. */
async function resolveGame(tournamentId: number, game: GameRef): Promise<{ riotMatchId: string; blue: string | null; red: string | null } | null> {
  if (game.source === "riot") return { riotMatchId: game.riotMatchId, blue: null, red: null };
  const listed = await findListedGame(tournamentId, game.leaguepediaGameId);
  return listed ? { riotMatchId: listed.riotMatchId, blue: listed.blue, red: listed.red } : null;
}

/** The match and timeline of a game, from its source. Both sources keep the raw pair in their own bucket prefix. */
async function loadGame(
  riotMatchId: string,
  game: GameRef,
  mode: GameLoadMode
): Promise<{ ok: true; payload: LolImportPayload; fromBucket: boolean } | { ok: false; error: GameImportError }> {
  if (game.source === "riot") {
    const loaded = await loadRiotGame(riotMatchId, mode);
    return loaded.ok ? loaded : { ok: false, error: riotLoadError(loaded.error) };
  }
  const loaded = await loadLeaguepediaGame(riotMatchId, mode);
  return loaded.ok ? loaded : { ok: false, error: loadError(loaded.error) };
}

function riotLoadError(error: RiotGameError): GameImportError {
  switch (error.kind) {
    case "tournamentRealm":
      return { kind: "tournamentRealm" };
    case "notInBucket":
      return { kind: "notInBucket" };
    case "storageUnavailable":
      return { kind: "storageUnavailable" };
    case "riotUnavailable":
      return relayProblem(error.error);
  }
}

/** An entrant of the series, with every name a Leaguepedia team name can be matched against. */
export interface SeriesEntrant {
  id: number;
  /** The entrant's display name. */
  name: string;
  teamId: number | null;
  /** The display name, the team's name and its short name. */
  names: string[];
  /** The Leaguepedia name an earlier import linked to the entrant's team (lol_leaguepedia_team_names). */
  leaguepediaName: string | null;
}

export async function findMatchEntrants(matchId: number): Promise<{ entrantAId: number; entrantBId: number; entrants: SeriesEntrant[] } | null> {
  const [match] = await db.select({ entrantAId: lolMatches.entrantAId, entrantBId: lolMatches.entrantBId }).from(lolMatches).where(eq(lolMatches.id, matchId)).limit(1);
  if (!match || match.entrantAId === null || match.entrantBId === null) return null;
  const rows = await db
    .select({
      id: lolEntrants.id,
      name: lolEntrants.displayName,
      teamId: lolEntrants.teamId,
      teamName: lolTeams.name,
      teamShortName: lolTeams.shortName,
      leaguepediaName: lolLeaguepediaTeamNames.name,
    })
    .from(lolEntrants)
    .leftJoin(lolTeams, eq(lolTeams.id, lolEntrants.teamId))
    .leftJoin(lolLeaguepediaTeamNames, eq(lolLeaguepediaTeamNames.teamId, lolEntrants.teamId))
    .where(inArray(lolEntrants.id, [match.entrantAId, match.entrantBId]));
  const entrants = rows.map((row): SeriesEntrant => ({
    id: row.id,
    name: row.name,
    teamId: row.teamId,
    names: [row.name, row.teamName, row.teamShortName].filter((name): name is string => Boolean(name)),
    leaguepediaName: row.leaguepediaName,
  }));
  return { entrantAId: match.entrantAId, entrantBId: match.entrantBId, entrants };
}

/**
 * The people known to play for an entrant: its roster, and the players already stored for it in any game. An entrant
 * belongs to one tournament, so this covers the earlier games of the series and of the tournament, without a roster.
 * The game being replaced is left out: it may have been saved with the sides swapped, which a re-import is there to fix.
 */
export async function knownPeopleOf(entrantId: number, replacedGameId: number | null): Promise<Set<number>> {
  const [roster, played] = await Promise.all([
    getEntrantPersonIds("lol", entrantId),
    db
      .selectDistinct({ personId: lolGamePlayerStats.personId })
      .from(lolGamePlayerStats)
      .where(and(eq(lolGamePlayerStats.entrantId, entrantId), replacedGameId === null ? undefined : ne(lolGamePlayerStats.gameId, replacedGameId))),
  ]);
  for (const row of played) if (row.personId !== null) roster.add(row.personId);
  return roster;
}

/**
 * The people of each team who could be an unlinked participant. A person who already has another account on the realm
 * stays a candidate (an alt or a new account is the case this exists for); only the people already linked to a
 * participant of this game are left out, since one person plays one slot.
 */
async function suggestionCandidates(knownByEntrant: Map<number, Set<number>>, linkedInGame: ReadonlySet<number>): Promise<Map<number, SuggestionCandidate[]>> {
  const personIds = [...new Set([...knownByEntrant.values()].flatMap((ids) => [...ids]))];
  const result = new Map<number, SuggestionCandidate[]>([...knownByEntrant.keys()].map((entrantId) => [entrantId, []]));
  if (personIds.length === 0) return result;

  const [known, played, saved] = await Promise.all([
    loadKnownPeople(personIds),
    db.selectDistinct({ personId: lolGamePlayerStats.personId, lane: lolGamePlayerStats.role }).from(lolGamePlayerStats).where(inArray(lolGamePlayerStats.personId, personIds)),
    db
      .select({ personId: lolRosterMemberships.personId, lane: lolRosterMembershipLanes.lane })
      .from(lolRosterMembershipLanes)
      .innerJoin(lolRosterMemberships, eq(lolRosterMemberships.id, lolRosterMembershipLanes.rosterMembershipId))
      .where(inArray(lolRosterMemberships.personId, personIds)),
  ]);

  const lanesOf = new Map<number, string[]>();
  for (const row of [...played, ...saved]) if (row.personId !== null && row.lane !== null) lanesOf.set(row.personId, [...(lanesOf.get(row.personId) ?? []), row.lane]);
  const candidateById = new Map(
    [...known.values()]
      .filter((person) => !linkedInGame.has(person.id))
      .map((person): [number, SuggestionCandidate] => [person.id, { id: person.id, handle: person.handle, aliases: person.aliases, lanes: sortLanes(lanesOf.get(person.id) ?? []) }])
  );
  for (const [entrantId, ids] of knownByEntrant) result.set(entrantId, [...ids].flatMap((id) => candidateById.get(id) ?? []));
  return result;
}

/** A Riot account of a person, as the search and the suggestions read it. */
export interface KnownAccount {
  puuid: string;
  personId: number;
  platform: string | null;
  cluster: string | null;
  lastSeenAt: Date | null;
}

export interface KnownPerson {
  id: number;
  handle: string;
  aliases: string[];
  accounts: KnownAccount[];
}

/** The people with their names and Riot accounts. A person without a League profile is left out. */
export async function loadKnownPeople(personIds: readonly number[]): Promise<Map<number, KnownPerson>> {
  const ids = [...new Set(personIds)];
  const known = new Map<number, KnownPerson>();
  if (ids.length === 0) return known;
  const [people, accounts] = await Promise.all([
    db.select({ id: lolPeople.id, handle: lolPeople.handle, aliases: lolPeople.aliases }).from(lolPeople).where(inArray(lolPeople.id, ids)),
    db
      .select({ puuid: lolPersonAccounts.puuid, personId: lolPersonAccounts.personId, platform: lolPersonAccounts.platform, cluster: lolPersonAccounts.cluster, lastSeenAt: lolPersonAccounts.lastSeenAt })
      .from(lolPersonAccounts)
      .where(inArray(lolPersonAccounts.personId, ids)),
  ]);
  for (const person of people) known.set(person.id, { id: person.id, handle: person.handle, aliases: Array.isArray(person.aliases) ? (person.aliases as string[]) : [], accounts: [] });
  for (const account of accounts) known.get(account.personId)?.accounts.push(account);
  return known;
}

/** The ranked suggestions of one unlinked participant, per entrant. */
function suggestionsFor(participant: { riotIdGameName?: string }, lane: string | null, candidates: Map<number, SuggestionCandidate[]>): Record<number, PersonRef[]> {
  const riotName = participant.riotIdGameName ?? "";
  return Object.fromEntries([...candidates].map(([entrantId, list]) => [entrantId, rankSuggestions(riotName, lane, list).map(({ id, handle }) => ({ id, handle }))]));
}

/** Links each side's Leaguepedia team name to the team of the entrant . */
async function rememberLeaguepediaTeamNames(names: { blue: string | null; red: string | null }, entrants: SeriesEntrant[], sides: Record<LeagueSide, number>): Promise<void> {
  const links = (["blue", "red"] as const).flatMap((side) => {
    const name = names[side]?.trim();
    const entrant = entrants.find((e) => e.id === sides[side]);
    return name && entrant?.teamId != null ? [{ teamId: entrant.teamId, name, known: entrant.leaguepediaName === name }] : [];
  });
  if (links.length === 0 || links.every((link) => link.known)) return;
  // Both sides on one team, or one name for both teams: nothing can be told apart, so nothing is learned.
  if (new Set(links.map((l) => l.teamId)).size !== links.length || new Set(links.map((l) => l.name.toLowerCase())).size !== links.length) return;
  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(lolLeaguepediaTeamNames)
        .where(
          or(
            inArray(lolLeaguepediaTeamNames.teamId, links.map((l) => l.teamId)),
            inArray(sql`lower(${lolLeaguepediaTeamNames.name})`, links.map((l) => l.name.toLowerCase()))
          )
        );
      await tx.insert(lolLeaguepediaTeamNames).values(links.map(({ teamId, name }) => ({ teamId, name })));
    });
  } catch (err) {
    console.error("[leaguepedia] could not remember the team names of the sides", err);
  }
}

async function linkedPeopleByPuuid(puuids: string[]) {
  const rows = await db
    .select({ puuid: lolPersonAccounts.puuid, id: lolPeople.id, handle: lolPeople.handle })
    .from(lolPersonAccounts)
    .innerJoin(lolPeople, eq(lolPeople.id, lolPersonAccounts.personId))
    .where(inArray(lolPersonAccounts.puuid, puuids));
  return new Map(rows.map((row) => [row.puuid, { id: row.id, handle: row.handle }] as const));
}

/**
 * Which entrant is blue. First the linked players: each one known to play for an entrant (its roster, or its earlier
 * games) is a vote, a blue player of A or a red player of B for "A is blue", and the other way round. A player known
 * to both entrants does not vote. Falls back to the team names of the list when the players do not decide it (a Riot
 * game has no names).
 */
export function suggestSides(
  names: { blue: string | null; red: string | null },
  match: RiotMatchDto,
  linked: Map<string, { id: number; handle: string }>,
  peopleA: Set<number>,
  peopleB: Set<number>,
  entrants: SeriesEntrant[],
  ids: { a: number; b: number }
): { sides: Record<LeagueSide, number>; from: "players" | "names" } | null {
  let aIsBlue = 0;
  let bIsBlue = 0;
  for (const p of match.info.participants) {
    const person = linked.get(p.puuid);
    if (!person) continue;
    const blue = sideForTeamId(p.teamId) === "blue";
    const knownToA = peopleA.has(person.id);
    // Known to neither or to both (a substitute, a transfer): says nothing about the sides.
    if (knownToA === peopleB.has(person.id)) continue;
    if (knownToA === blue) aIsBlue++;
    else bIsBlue++;
  }
  if (aIsBlue > bIsBlue) return { sides: { blue: ids.a, red: ids.b }, from: "players" };
  if (bIsBlue > aIsBlue) return { sides: { blue: ids.b, red: ids.a }, from: "players" };

  const byNames = sidesFromNames(names, entrants, ids);
  return byNames ? { sides: byNames, from: "names" } : null;
}

/** The sides from the list's blue and red team names. One recognised name is enough: the other side is the other entrant. */
export function sidesFromNames(names: { blue: string | null; red: string | null }, entrants: SeriesEntrant[], ids: { a: number; b: number }): Record<LeagueSide, number> | null {
  const candidates = entrants.filter((e) => e.id === ids.a || e.id === ids.b);
  const blue = entrantForName(names.blue, candidates);
  const red = entrantForName(names.red, candidates);
  const other = (id: number) => (id === ids.a ? ids.b : ids.a);
  if (blue !== null && red !== null) return blue === red ? null : { blue, red };
  if (blue !== null) return { blue, red: other(blue) };
  if (red !== null) return { blue: other(red), red };
  return null;
}

/**
 * The entrant a Leaguepedia team name stands for: the one whose team an earlier import linked to that name, else the
 * one with the closest own name (compareTeamNames from the Liquipedia matching, exact or confident only). Null when
 * nothing matches, or both entrants match equally well.
 */
export function entrantForName(name: string | null, entrants: SeriesEntrant[]): number | null {
  if (!name?.trim()) return null;
  const key = name.trim().toLowerCase();
  const linked = entrants.find((e) => e.leaguepediaName?.trim().toLowerCase() === key);
  if (linked) return linked.id;

  const scored = entrants.map((e) => ({
    id: e.id,
    score: Math.max(
      0,
      ...e.names.map((own) => {
        const result = compareTeamNames(own, name);
        return result && result.confidence !== "possible" ? result.score : 0;
      })
    ),
  }));
  const best = Math.max(0, ...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === best);
  return best > 0 && top.length === 1 ? top[0]!.id : null;
}

type RiotGameError = { kind: "tournamentRealm" } | { kind: "notInBucket" } | { kind: "storageUnavailable" } | { kind: "riotUnavailable"; error: RiotRelayError };

type RiotGameResult = { ok: true; payload: LolImportPayload; fromBucket: boolean } | { ok: false; error: RiotGameError };

/**
 * The match and timeline of a Riot game, from the LoL imports bucket (riot/<id>) or from RiotRelay. A tournament-realm
 * game is refused before any request, because the public API does not serve it and the request would only use up rate limit.
 * fetch: the bucket, or RiotRelay when the game is not there. renew: RiotRelay, always. reprocess: the bucket only.
 */
async function loadRiotGame(riotMatchId: string, mode: GameLoadMode): Promise<RiotGameResult> {
  if (isTournamentRealm(riotMatchId)) return { ok: false, error: { kind: "tournamentRealm" } };
  const cluster = riotCluster(riotMatchId);
  if (cluster === null) return { ok: false, error: { kind: "riotUnavailable", error: { kind: "invalidRequest" } } };

  if (mode !== "renew") {
    let stored: LolImportPayload | null;
    try {
      stored = await readLolImport("riot", riotMatchId);
    } catch (err) {
      // A bucket that cannot be read is not a game that is missing: fetching from Riot would hide the setup problem.
      console.error(`[riot] could not read game ${riotMatchId} from the imports bucket`, err);
      return { ok: false, error: { kind: "storageUnavailable" } };
    }
    if (stored) return { ok: true, payload: stored, fromBucket: true };
    if (mode === "reprocess") return { ok: false, error: { kind: "notInBucket" } };
  }

  const match = mode === "renew" ? await renewLolMatch(cluster, riotMatchId) : await getLolMatch(cluster, riotMatchId);
  if (!match.ok) return { ok: false, error: { kind: "riotUnavailable", error: match.error } };
  const timeline = mode === "renew" ? await renewLolTimeline(cluster, riotMatchId) : await getLolTimeline(cluster, riotMatchId);
  if (!timeline.ok) return { ok: false, error: { kind: "riotUnavailable", error: timeline.error } };
  return { ok: true, payload: { match: match.data, timeline: timeline.data }, fromBucket: false };
}

function loadError(error: { kind: string; error?: { kind: string } }): GameImportError {
  switch (error.kind) {
    case "notInBucket":
      return { kind: "notInBucket" };
    case "storageUnavailable":
      return { kind: "storageUnavailable" };
    case "leaguepedia":
      return error.error?.kind === "missingConfig" ? { kind: "missingConfig" } : { kind: "fetch" };
    default:
      return { kind: "pageInvalid" };
  }
}
