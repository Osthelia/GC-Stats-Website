/**
 * GC-Stats - fetch-leaguepedia-game
 *
 * Stores one Leaguepedia game as a game of a series: the Leaguepedia row gives the Riot match id and
 * the two team names, the match gives its two entrants, and every Riot player must already be a person
 * with that `lol_id`. The game is then stored through importGame, which keeps the raw pair in the bucket.
 * No auth here: the action checks the permission and calls this.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
// adminDb: these reads must see writes made moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { lolEntrants, lolLeaguepediaGames, lolMatches, lolPeople } from "@gc-stats/db";
import { validateImport, type LeagueSide } from "@gc-stats/lol-stats-engine";
import { importGame } from "./import-game";
import { loadLeaguepediaGame, type LeaguepediaGameMode } from "./leaguepedia-game";

export type FetchLeaguepediaGameError =
  | { kind: "noData" }
  | { kind: "notInBucket" }
  | { kind: "pageInvalid" }
  | { kind: "fetch" }
  | { kind: "missingConfig" }
  | { kind: "invalidOrder" }
  | { kind: "sidesUnresolved" }
  | { kind: "missingPlayers"; count: number }
  | { kind: "invalidUpload"; errors: string[] }
  | { kind: "storeFailed"; message: string };

export type FetchLeaguepediaGameResult = { ok: true; gameId: number; fromBucket: boolean } | { ok: false; error: FetchLeaguepediaGameError };

export interface FetchLeaguepediaGameInput {
  tournamentId: number;
  matchId: number;
  leaguepediaGameId: string;
  order: number;
  mode: LeaguepediaGameMode;
}

export async function fetchLeaguepediaGameIntoMatch(input: FetchLeaguepediaGameInput): Promise<FetchLeaguepediaGameResult> {
  if (!Number.isInteger(input.order) || input.order < 1) return { ok: false, error: { kind: "invalidOrder" } };
  const [listed] = await db
    .select()
    .from(lolLeaguepediaGames)
    .where(and(eq(lolLeaguepediaGames.leaguepediaGameId, input.leaguepediaGameId), eq(lolLeaguepediaGames.tournamentId, input.tournamentId)))
    .limit(1);
  if (!listed || !listed.hasData || !listed.riotMatchId) return { ok: false, error: { kind: "noData" } };

  const [match] = await db.select({ entrantAId: lolMatches.entrantAId, entrantBId: lolMatches.entrantBId }).from(lolMatches).where(eq(lolMatches.id, input.matchId)).limit(1);
  if (!match || match.entrantAId === null || match.entrantBId === null) return { ok: false, error: { kind: "sidesUnresolved" } };

  const entrants = await db
    .select({ id: lolEntrants.id, displayName: lolEntrants.displayName })
    .from(lolEntrants)
    .where(inArray(lolEntrants.id, [match.entrantAId, match.entrantBId]));
  const entrantIdBySide = sidesFromNames({ blue: listed.blue, red: listed.red }, entrants, { a: match.entrantAId, b: match.entrantBId });
  if (!entrantIdBySide) return { ok: false, error: { kind: "sidesUnresolved" } };

  const loaded = await loadLeaguepediaGame(listed.riotMatchId, input.mode);
  if (!loaded.ok) return { ok: false, error: loadError(loaded.error) };

  const validation = validateImport(loaded.payload.match, loaded.payload.timeline);
  if (!validation.ok) return { ok: false, error: { kind: "invalidUpload", errors: validation.errors } };

  const puuids = validation.match.info.participants.map((p) => p.puuid);
  const people = await db.select({ id: lolPeople.id, lolId: lolPeople.lolId }).from(lolPeople).where(inArray(lolPeople.lolId, puuids));
  const personIdByPuuid = new Map(people.flatMap((p) => (p.lolId ? [[p.lolId, p.id] as const] : [])));
  const missing = puuids.filter((puuid) => !personIdByPuuid.has(puuid));
  if (missing.length > 0) return { ok: false, error: { kind: "missingPlayers", count: missing.length } };

  try {
    const stored = await importGame({
      matchId: input.matchId,
      order: input.order,
      match: loaded.payload.match,
      timeline: loaded.payload.timeline,
      source: "leaguepedia",
      entrantIdBySide,
      personIdByPuuid,
    });
    if (!stored.ok) return { ok: false, error: { kind: "invalidUpload", errors: stored.error.errors } };
    return { ok: true, gameId: stored.gameId, fromBucket: loaded.fromBucket };
  } catch (err) {
    return { ok: false, error: { kind: "storeFailed", message: err instanceof Error ? err.message : String(err) } };
  }
}

/** Blue and red by team name, case and surrounding spaces ignored. Null unless both names match one entrant each. */
export function sidesFromNames(
  names: { blue: string | null; red: string | null },
  entrants: { id: number; displayName: string }[],
  ids: { a: number; b: number },
): Record<LeagueSide, number> | null {
  const idOf = (name: string | null): number | null => {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    const hit = entrants.find((e) => e.displayName.trim().toLowerCase() === key);
    return hit && (hit.id === ids.a || hit.id === ids.b) ? hit.id : null;
  };
  const blue = idOf(names.blue);
  const red = idOf(names.red);
  if (blue === null || red === null || blue === red) return null;
  return { blue, red };
}

function loadError(error: { kind: string; error?: { kind: string } }): FetchLeaguepediaGameError {
  switch (error.kind) {
    case "notInBucket":
      return { kind: "notInBucket" };
    case "leaguepedia":
      return error.error?.kind === "missingConfig" ? { kind: "missingConfig" } : { kind: "fetch" };
    default:
      return { kind: "pageInvalid" };
  }
}
