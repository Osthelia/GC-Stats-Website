/**
 * GC-Stats - fetch-leaguepedia-game
 *
 * One Leaguepedia game in two steps. `prepare` loads the game (bucket or Leaguepedia), checks it, keeps
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
import { inferRoles, LEAGUE_ROLES, resolvePlayerRoles, roleOf, sideForTeamId, validateImport, type LeagueSide, type RiotMatchDto } from "@gc-stats/lol-stats-engine";
import { storeLolImport, readLolImport } from "@gc-stats/storage";
import { getDataDragonCatalog } from "@/lib/data-dragon-client";
import { createPerson, ensureGameProfile } from "@/lib/person-service";
import { getEntrantPersonIds } from "@/lib/map-fetch/identity-resolution";
import { importGame } from "./import-game";
import { loadLeaguepediaGame, type LeaguepediaGameMode } from "./leaguepedia-game";

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
  | { kind: "invalidUpload"; errors: string[] }
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
  leaguepediaGameId: string;
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
  leaguepediaGameId: string;
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
  leaguepediaGameId: string;
  order: number;
  entrantIdBySide: Record<LeagueSide, number>;
  mappings: PlayerMapping[];
  /** The admin's role overrides by puuid, only where the role differs from the inferred one. */
  roleOverrides: Record<string, string | null>;
}

export type CommitResult = { ok: true; gameId: number } | { ok: false; error: LeaguepediaGameError };

export async function prepareLeaguepediaGame(input: PrepareInput): Promise<PrepareResult> {
  const listed = await findListedGame(input.tournamentId, input.leaguepediaGameId);
  if (!listed) return { ok: false, error: { kind: "noData" } };

  const match = await findMatchEntrants(input.matchId);
  if (!match) return { ok: false, error: { kind: "sidesUnresolved" } };

  const loaded = await loadLeaguepediaGame(listed.riotMatchId, input.mode);
  if (!loaded.ok) return { ok: false, error: loadError(loaded.error) };

  const validation = validateImport(loaded.payload.match, loaded.payload.timeline);
  if (!validation.ok) return { ok: false, error: { kind: "invalidUpload", errors: validation.errors } };

  // The raw pair is kept before anything else, so the commit can read it back without asking Leaguepedia again.
  if (!loaded.fromBucket) await storeLolImport("leaguepedia", listed.riotMatchId, { match: validation.match, timeline: validation.timeline });

  const catalog = await getDataDragonCatalog();
  const riotMatch = validation.match;
  const roleOverrides = await savedRoleOverrides(listed.riotMatchId);
  const inferred = inferRoles(riotMatch, validation.timeline);
  const effective = resolvePlayerRoles(riotMatch, validation.timeline, roleOverrides);
  const puuids = riotMatch.info.participants.map((p) => p.puuid);
  const linked = await linkedPeopleByPuuid(puuids);

  const rosterA = await getEntrantPersonIds("lol", match.entrantAId);
  const rosterB = await getEntrantPersonIds("lol", match.entrantBId);
  const entrantNames = new Map(match.entrants.map((e) => [e.id, e.name]));
  const suggestion = suggestSides({ blue: listed.blue, red: listed.red }, riotMatch, linked, rosterA, rosterB, match.entrants, {
    a: match.entrantAId,
    b: match.entrantBId,
  });

  const winnerTeam = riotMatch.info.teams.find((t) => t.win);
  return {
    ok: true,
    preview: {
      leaguepediaGameId: listed.leaguepediaGameId,
      mode: input.mode,
      riotMatchId: listed.riotMatchId,
      teams: { blue: listed.blue, red: listed.red },
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
          championName: catalog.championNameById.get(p.championId) ?? p.championName,
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

  const listed = await findListedGame(input.tournamentId, input.leaguepediaGameId);
  if (!listed) return { ok: false, error: { kind: "noData" } };

  const match = await findMatchEntrants(input.matchId);
  if (!match) return { ok: false, error: { kind: "sidesUnresolved" } };
  const { blue, red } = input.entrantIdBySide;
  const entrantIds = new Set([match.entrantAId, match.entrantBId]);
  if (blue === red || !entrantIds.has(blue) || !entrantIds.has(red)) return { ok: false, error: { kind: "sidesInvalid" } };

  const stored = await readLolImport("leaguepedia", listed.riotMatchId);
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
      source: "leaguepedia",
      entrantIdBySide: input.entrantIdBySide,
      personIdByPuuid,
      roleOverrides: input.roleOverrides,
      replaceGameId: input.gameId,
    });
    if (!stored.ok) return { ok: false, error: { kind: "invalidUpload", errors: stored.error.errors } };
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

function loadError(error: { kind: string; error?: { kind: string } }): LeaguepediaGameError {
  switch (error.kind) {
    case "notInBucket":
      return { kind: "notInBucket" };
    case "leaguepedia":
      return error.error?.kind === "missingConfig" ? { kind: "missingConfig" } : { kind: "fetch" };
    default:
      return { kind: "pageInvalid" };
  }
}
