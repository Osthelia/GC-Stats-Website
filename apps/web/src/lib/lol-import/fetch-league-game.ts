/**
 * GC-Stats - fetch-league-game
 *
 * One game in two steps, from a Leaguepedia list entry or a Riot match id. `prepare` loads the game (bucket or
 * its source), checks it, keeps
 * the raw pair in the bucket and returns a preview: teams, winner, players, champions, and the entrant
 * sides suggested from the mapped players or the team names. Nothing else is written. `commit` takes the
 * admin's choices (which person each unknown Riot account is, and which entrant is blue and red), writes
 * the lol_id links with conflict handling, and stores the game through importGame. No auth here: the
 * actions check the permission and call these.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
// adminDb: these reads must see writes made moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { lolEntrants, lolGames, lolLeaguepediaGames, lolMatches, lolPeople, lolPersonProfiles } from "@gc-stats/db";
import {
  championNameOf,
  inferRoles,
  isTournamentRealmMatchId,
  LEAGUE_ROLES,
  missingChampionIds,
  resolvePlayerRoles,
  riotCluster,
  roleOf,
  sideForTeamId,
  validateImport,
  type LeagueSide,
  type RiotMatchDto,
} from "@gc-stats/lol-stats-engine";
import { storeLolImport, readLolImport, type LolImportPayload } from "@gc-stats/storage";
import { getChampionCatalog } from "@/lib/data-dragon-client";
import { getLolMatch, getLolTimeline, renewLolMatch, renewLolTimeline } from "@/lib/lol-relay-client";
import type { RiotRelayError } from "@/lib/riot-relay-transport";
import { createPerson, ensureGameProfile } from "@/lib/person-service";
import { getEntrantPersonIds } from "@/lib/map-fetch/identity-resolution";
import { importGame } from "./import-game";
import { loadLeaguepediaGame, type LeaguepediaGameMode } from "./leaguepedia-game";

/** Where a game comes from: a Leaguepedia list entry, or a Riot match id that RiotRelay serves. */
export type GameRef = { source: "leaguepedia"; leaguepediaGameId: string } | { source: "riot"; riotMatchId: string };

export type LeaguepediaGameError =
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
  | { kind: "lolIdConflict"; puuid: string }
  | { kind: "duplicateAccount" }
  | { kind: "invalidUpload"; errors: string[] }
  | { kind: "dataDragonUnavailable" }
  | { kind: "unknownChampions"; ids: number[] }
  | { kind: "storageUnavailable" }
  | { kind: "riotUnavailable" }
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
  /** The person this account is linked to, null when it is not linked yet. */
  person: { id: number; handle: string } | null;
  /** The role the stats use: the admin's override, else the inferred one. */
  role: string | null;
  /** The role inferred from the positions, before any override. */
  inferredRole: string | null;
  /** Riot's own teamPosition, shown for reference only (unreliable for esports games). */
  riotRole: string | null;
}

export interface LeaguepediaPreview {
  game: GameRef;
  /** How the game was loaded: fetch, renew or reprocess. Carried to the save for the activity log. */
  mode: LeaguepediaGameMode;
  riotMatchId: string;
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

export type PrepareResult = { ok: true; preview: LeaguepediaPreview } | { ok: false; error: LeaguepediaGameError };

export interface PrepareInput {
  tournamentId: number;
  matchId: number;
  game: GameRef;
  mode: LeaguepediaGameMode;
}

/** One unknown Riot account: link it to an existing person, or create a person for it. */
export interface PlayerMapping {
  puuid: string;
  personId: number | null;
  createHandle: string | null;
}

export interface CommitInput {
  /** How the game was loaded, for the activity log. */
  mode: LeaguepediaGameMode;
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

export type CommitResult = { ok: true; gameId: number } | { ok: false; error: LeaguepediaGameError };

export async function prepareLeaguepediaGame(input: PrepareInput): Promise<PrepareResult> {
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
  const inferred = inferRoles(riotMatch, validation.timeline);
  const effective = resolvePlayerRoles(riotMatch, validation.timeline, roleOverrides);
  const puuids = riotMatch.info.participants.map((p) => p.puuid);
  const linked = await linkedPeopleByPuuid(puuids);

  const rosterA = await getEntrantPersonIds("lol", match.entrantAId);
  const rosterB = await getEntrantPersonIds("lol", match.entrantBId);
  const entrantNames = new Map(match.entrants.map((e) => [e.id, e.name]));
  const suggestion = suggestSides({ blue: resolved.blue, red: resolved.red }, riotMatch, linked, rosterA, rosterB, match.entrants, {
    a: match.entrantAId,
    b: match.entrantBId,
  });

  const winnerTeam = riotMatch.info.teams.find((t) => t.win);
  return {
    ok: true,
    preview: {
      game: input.game,
      mode: input.mode,
      riotMatchId: resolved.riotMatchId,
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
          riotId: p.riotIdGameName ? `${p.riotIdGameName}${p.riotIdTagline ? `#${p.riotIdTagline}` : ""}` : p.puuid.slice(0, 8),
          side: sideForTeamId(p.teamId),
          role: effective.get(p.participantId) ?? null,
          inferredRole: inferred?.get(p.participantId) ?? roleOf(p.teamPosition),
          riotRole: p.teamPosition || null,
          championName: championNameOf(catalog.championNameById, p.championId),
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          person: person ? { id: person.id, handle: person.handle } : null,
        };
      }),
      roleOverrides,
    },
  };
}

export async function commitLeaguepediaGame(input: CommitInput): Promise<CommitResult> {
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

  for (const puuid of puuids) {
    const mapping = mappingByPuuid.get(puuid);
    if (linked.has(puuid) || !mapping) continue;
    const conflict = await persistMapping(mapping);
    if (conflict) return { ok: false, error: { kind: "lolIdConflict", puuid: conflict } };
  }

  const relinked = await linkedPeopleByPuuid(puuids);
  const personIdByPuuid = new Map([...relinked].map(([puuid, person]) => [puuid, person.id]));
  try {
    const stored = await importGame({
      matchId: input.matchId,
      order: input.order,
      match: validation.match,
      timeline: validation.timeline,
      source: input.game.source,
      entrantIdBySide: input.entrantIdBySide,
      personIdByPuuid,
      roleOverrides: input.roleOverrides,
      replaceGameId: input.gameId,
      rawStored: true,
    });
    if (!stored.ok) return { ok: false, error: stored.error };
    return { ok: true, gameId: stored.gameId };
  } catch (err) {
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

/**
 * Links one Riot account to a person, or creates the person with it. An account that another person
 * already holds is never moved; the caller gets its puuid back as the conflict.
 */
async function persistMapping(mapping: PlayerMapping): Promise<string | null> {
  const [holder] = await db.select({ personId: lolPersonProfiles.personId }).from(lolPersonProfiles).where(eq(lolPersonProfiles.lolId, mapping.puuid)).limit(1);
  try {
    if (mapping.personId !== null) {
      if (holder?.personId === mapping.personId) return null;
      if (holder) return mapping.puuid;
      // A person keeps the account they already have: replacing it would drop that link.
      const [own] = await db.select({ lolId: lolPersonProfiles.lolId }).from(lolPersonProfiles).where(eq(lolPersonProfiles.personId, mapping.personId)).limit(1);
      if (own?.lolId) return mapping.puuid;
      await ensureGameProfile(db, "lol", mapping.personId);
      await db.update(lolPersonProfiles).set({ lolId: mapping.puuid }).where(eq(lolPersonProfiles.personId, mapping.personId));
      return null;
    }
    if (holder) return mapping.puuid;
    const handle = (mapping.createHandle ?? "").trim();
    await db.transaction(async (tx) => createPerson(tx, "lol", { handle }, { lolId: mapping.puuid }));
    return null;
  } catch (err) {
    // The unique constraint on lol_id catches a concurrent link of the same account.
    console.warn(`[leaguepedia] lol_id ${mapping.puuid} could not be linked: ${err instanceof Error ? err.message : String(err)}`);
    return mapping.puuid;
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
  mode: LeaguepediaGameMode
): Promise<{ ok: true; payload: LolImportPayload; fromBucket: boolean } | { ok: false; error: LeaguepediaGameError }> {
  if (game.source === "riot") {
    const loaded = await loadRiotGame(riotMatchId, mode);
    return loaded.ok ? loaded : { ok: false, error: riotLoadError(loaded.error) };
  }
  const loaded = await loadLeaguepediaGame(riotMatchId, mode);
  return loaded.ok ? loaded : { ok: false, error: loadError(loaded.error) };
}

function riotLoadError(error: RiotGameError): LeaguepediaGameError {
  switch (error.kind) {
    case "tournamentRealm":
      return { kind: "tournamentRealm" };
    case "notInBucket":
      return { kind: "notInBucket" };
    case "storageUnavailable":
      return { kind: "storageUnavailable" };
    case "riotUnavailable":
      return error.error.kind === "missingConfig" ? { kind: "missingConfig" } : { kind: "riotUnavailable" };
  }
}

async function findMatchEntrants(matchId: number) {
  const [match] = await db.select({ entrantAId: lolMatches.entrantAId, entrantBId: lolMatches.entrantBId }).from(lolMatches).where(eq(lolMatches.id, matchId)).limit(1);
  if (!match || match.entrantAId === null || match.entrantBId === null) return null;
  const entrants = await db
    .select({ id: lolEntrants.id, name: lolEntrants.displayName })
    .from(lolEntrants)
    .where(inArray(lolEntrants.id, [match.entrantAId, match.entrantBId]));
  return { entrantAId: match.entrantAId, entrantBId: match.entrantBId, entrants };
}

async function linkedPeopleByPuuid(puuids: string[]) {
  const rows = await db.select({ id: lolPeople.id, handle: lolPeople.handle, lolId: lolPeople.lolId }).from(lolPeople).where(inArray(lolPeople.lolId, puuids));
  return new Map(rows.flatMap((row) => (row.lolId ? [[row.lolId, { id: row.id, handle: row.handle }] as const] : [])));
}

/**
 * Which entrant is blue: the one whose roster holds more of the blue players. Falls back to the team names
 * of the list when the players do not decide it.
 */
export function suggestSides(
  names: { blue: string | null; red: string | null },
  match: RiotMatchDto,
  linked: Map<string, { id: number; handle: string }>,
  rosterA: Set<number>,
  rosterB: Set<number>,
  entrants: { id: number; name: string }[],
  ids: { a: number; b: number }
): { sides: Record<LeagueSide, number>; from: "players" | "names" } | null {
  let blueA = 0;
  let blueB = 0;
  for (const p of match.info.participants) {
    const person = linked.get(p.puuid);
    if (!person || sideForTeamId(p.teamId) !== "blue") continue;
    if (rosterA.has(person.id)) blueA++;
    if (rosterB.has(person.id)) blueB++;
  }
  if (blueA > blueB) return { sides: { blue: ids.a, red: ids.b }, from: "players" };
  if (blueB > blueA) return { sides: { blue: ids.b, red: ids.a }, from: "players" };

  const byNames = sidesFromNames(names, entrants, ids);
  return byNames ? { sides: byNames, from: "names" } : null;
}

/** Blue and red by team name, case and surrounding spaces ignored. Null unless both names match one entrant each. */
export function sidesFromNames(
  names: { blue: string | null; red: string | null },
  entrants: { id: number; name: string }[],
  ids: { a: number; b: number }
): Record<LeagueSide, number> | null {
  const idOf = (name: string | null): number | null => {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    const hit = entrants.find((e) => e.name.trim().toLowerCase() === key);
    return hit && (hit.id === ids.a || hit.id === ids.b) ? hit.id : null;
  };
  const blue = idOf(names.blue);
  const red = idOf(names.red);
  if (blue === null || red === null || blue === red) return null;
  return { blue, red };
}

type RiotGameError = { kind: "tournamentRealm" } | { kind: "notInBucket" } | { kind: "storageUnavailable" } | { kind: "riotUnavailable"; error: RiotRelayError };

type RiotGameResult = { ok: true; payload: LolImportPayload; fromBucket: boolean } | { ok: false; error: RiotGameError };

/**
 * The match and timeline of a Riot game, from the LoL imports bucket (riot/<id>) or from RiotRelay. A tournament-realm
 * game is refused before any request, because the public API does not serve it and the request would only use up rate limit.
 * fetch: the bucket, or RiotRelay when the game is not there. renew: RiotRelay, always. reprocess: the bucket only.
 */
async function loadRiotGame(riotMatchId: string, mode: LeaguepediaGameMode): Promise<RiotGameResult> {
  if (isTournamentRealmMatchId(riotMatchId)) return { ok: false, error: { kind: "tournamentRealm" } };
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

function loadError(error: { kind: string; error?: { kind: string } }): LeaguepediaGameError {
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
