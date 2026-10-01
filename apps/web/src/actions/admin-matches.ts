/**
 * GC-Stats - admin-matches
 *
 * Admin server actions for editing match details and results (vetoes, maps,
 * player/round stats). A completed match's participants are locked since
 * its result and bracket propagation already depend on them.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq, ne, and, inArray, or, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { matches, entrants, maps, matchVetos, mapPlayerStats, mapTeamRoundSummary, mapRoundsRaw, stageContainers, stages, teams, liquipediaTeamNames, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { matchTag } from "@/lib/cache-tags";
import { resolveMatch, MatchResolutionValidationError } from "@/lib/bracket/match-resolution-service";
import { MAP_OPTIONS, MAP_UNKNOWN, VALORANT_MAP_POOL } from "@/lib/valorant-maps";
import { VALORANT_AGENTS } from "@/lib/valorant-agents";
import { parseMapVeto, parseMapTemplates, parseMatchOpponentNames } from "@/lib/wikicode-import";
import { findLiquipediaMappings } from "@/lib/admin-liquipedia";
import { validateLiquipediaName } from "@/lib/liquipedia-name-validation";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

// --- Match details (non-result fields) -------------------------------------

export type MatchDetailsField = "entrantAId" | "entrantBId" | "status" | "scheduledAt" | "bestOf" | "patch" | "label";
export type MatchDetailsFieldErrors = Partial<Record<MatchDetailsField, string>>;
export type MatchDetailsInput = {
  entrantAId: number | null;
  entrantBId: number | null;
  status: "pending" | "live" | "completed";
  scheduledAt: string; // datetime-local, may be empty
  bestOf: string;
  patch: string;
  label: string;
};
export type MatchDetailsResult = { ok: true } | { ok: false; fieldErrors: MatchDetailsFieldErrors };

export async function updateMatchDetails(matchId: number, input: MatchDetailsInput): Promise<MatchDetailsResult> {
  await requireTournamentsActor();

  const [existing] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { label: "notFound" } };

  const fieldErrors: MatchDetailsFieldErrors = {};

  // A completed match's participants are locked (its result and any
  // downstream bracket propagation already depend on them). Status and best
  // of stay editable even once completed, to let an admin correct a mistake
  // (wrong format, need to reopen a match) — only the status transition
  // *into* "completed" is guarded below, since that must go through
  // resolveMatch (winner/score), never this form.
  const locked = existing.status === "completed";

  if (!locked) {
    if (input.entrantAId !== null && input.entrantBId !== null && input.entrantAId === input.entrantBId) {
      fieldErrors.entrantBId = "sameEntrant";
    }
    const [matchTournament] = await db
      .select({ tournamentId: stages.tournamentId })
      .from(stageContainers)
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .where(eq(stageContainers.id, existing.containerId))
      .limit(1);
    for (const [field, id] of [
      ["entrantAId", input.entrantAId],
      ["entrantBId", input.entrantBId],
    ] as const) {
      if (id === null) continue;
      const [row] = await db
        .select({ id: entrants.id })
        .from(entrants)
        .where(and(eq(entrants.id, id), eq(entrants.tournamentId, matchTournament!.tournamentId)))
        .limit(1);
      if (!row) fieldErrors[field] = "entrantNotFound";
    }
  }

  const bestOf = Number(input.bestOf);
  if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf > 99) fieldErrors.bestOf = "invalid";

  if (input.status !== "pending" && input.status !== "live" && input.status !== "completed") {
    fieldErrors.status = "invalid";
  } else if (input.status === "completed" && !locked) {
    fieldErrors.status = "invalid";
  }

  if (input.scheduledAt) {
    const d = new Date(input.scheduledAt);
    if (Number.isNaN(d.getTime())) fieldErrors.scheduledAt = "invalid";
  }
  if (input.patch.trim().length > 20) fieldErrors.patch = "tooLong";
  if (input.label.trim().length > 255) fieldErrors.label = "tooLong";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(matches)
    .set({
      ...(locked ? {} : { entrantAId: input.entrantAId, entrantBId: input.entrantBId }),
      status: input.status,
      bestOf,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      patch: input.patch.trim() || null,
      label: input.label.trim() || null,
    })
    .where(eq(matches.id, matchId));
  updateTag(matchTag(matchId));

  return { ok: true };
}

export type DeleteMatchResult = { ok: true } | { ok: false; error: "notFound" | "completedLocked" };

/** V1's admin/matches/show.blade.php delete button — a completed match is locked (mirrors the same guard already used for entrant/status/bestOf edits above: its result may already be propagated through the bracket). */
export async function deleteMatch(matchId: number): Promise<DeleteMatchResult> {
  await requireTournamentsActor();

  const [existing] = await db.select({ id: matches.id, status: matches.status }).from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (existing.status === "completed") return { ok: false, error: "completedLocked" };

  await db.delete(matches).where(eq(matches.id, matchId));
  return { ok: true };
}

// --- Result reporting --------------------------------------------------------

export type ReportResultField = "winnerId" | "score" | "matchId";
export type ReportResultFieldErrors = Partial<Record<ReportResultField, string>>;
// No `isForfeit` field — V1 has no such column, a lone `-1` score IS the
// forfeit (mirrors Website's Matchs/GameMap convention), derived inside
// resolveMatch itself. `-1` is the only negative value accepted.
export type ReportResultInput = { winnerId: number; scoreA: string; scoreB: string };
export type ReportResultResult = { ok: true } | { ok: false; fieldErrors: ReportResultFieldErrors };

export async function reportMatchResult(matchId: number, input: ReportResultInput): Promise<ReportResultResult> {
  await requireTournamentsActor();

  const fieldErrors: ReportResultFieldErrors = {};
  const scoreA = Number(input.scoreA);
  const scoreB = Number(input.scoreB);
  if (!Number.isInteger(scoreA) || scoreA < -1) fieldErrors.score = "invalid";
  else if (!Number.isInteger(scoreB) || scoreB < -1) fieldErrors.score = "invalid";
  else if (scoreA === -1 && scoreB === -1) fieldErrors.score = "bothCannotForfeit";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  try {
    await resolveMatch({ matchId, winnerId: input.winnerId, scoreA, scoreB });
  } catch (err) {
    if (err instanceof MatchResolutionValidationError) {
      const mapped: ReportResultFieldErrors = {};
      for (const [field, code] of Object.entries(err.fieldErrors)) {
        if (field === "winnerId") mapped.winnerId = code;
        else if (field === "score") mapped.score = code;
        else mapped.matchId = code;
      }
      return { ok: false, fieldErrors: mapped };
    }
    throw err;
  }
  updateTag(matchTag(matchId));

  return { ok: true };
}

// --- Veto --------------------------------------------------------------------

export type VetoRowInput = {
  entrantId: number;
  mapName: string;
  type: "pick" | "ban" | "decider";
  side: "atk" | "def" | null;
  sidePickedByEntrantId: number | null;
};
export type VetoFieldErrors = Partial<Record<"rows", string>>;
export type SaveVetoResult = { ok: true } | { ok: false; fieldErrors: VetoFieldErrors };

export async function saveMatchVeto(matchId: number, rows: VetoRowInput[]): Promise<SaveVetoResult> {
  await requireTournamentsActor();

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return { ok: false, fieldErrors: { rows: "notFound" } };
  if (match.entrantAId === null || match.entrantBId === null) return { ok: false, fieldErrors: { rows: "bothSlotsRequired" } };

  const validEntrantIds = new Set([match.entrantAId, match.entrantBId]);
  const seenMaps = new Set<string>();

  for (const row of rows) {
    if (!validEntrantIds.has(row.entrantId)) return { ok: false, fieldErrors: { rows: "invalidEntrant" } };
    if (!MAP_OPTIONS.includes(row.mapName as (typeof MAP_OPTIONS)[number])) return { ok: false, fieldErrors: { rows: "invalidMap" } };
    if (row.mapName !== MAP_UNKNOWN) {
      if (seenMaps.has(row.mapName)) return { ok: false, fieldErrors: { rows: "duplicateMap" } };
      seenMaps.add(row.mapName);
    }
    if (row.type !== "pick" && row.type !== "ban" && row.type !== "decider") return { ok: false, fieldErrors: { rows: "invalidType" } };
    if (row.type === "ban") {
      if (row.side !== null || row.sidePickedByEntrantId !== null) return { ok: false, fieldErrors: { rows: "banHasNoSide" } };
    } else {
      if (row.side !== null && row.side !== "atk" && row.side !== "def") return { ok: false, fieldErrors: { rows: "invalidSide" } };
      if (row.sidePickedByEntrantId !== null && !validEntrantIds.has(row.sidePickedByEntrantId)) return { ok: false, fieldErrors: { rows: "invalidEntrant" } };
      // BO1 decider exception (2026-09-01, deliberately diverges from V1's
      // "opposite team defaults" behaviour): the team credited for the
      // decider map and the team choosing attack/defense on it are always
      // the SAME team for a single-map match, not two different teams.
      if (match.bestOf === 1 && row.type === "decider" && row.sidePickedByEntrantId !== null && row.sidePickedByEntrantId !== row.entrantId) {
        return { ok: false, fieldErrors: { rows: "bo1DeciderSameTeam" } };
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(matchVetos).where(eq(matchVetos.matchId, matchId));
    if (rows.length === 0) return;
    await tx.insert(matchVetos).values(
      rows.map((row, index) => ({
        matchId,
        entrantId: row.entrantId,
        mapName: row.mapName,
        type: row.type,
        order: index + 1,
        side: row.side,
        sidePickedByEntrantId: row.sidePickedByEntrantId,
      }))
    );
  });

  return { ok: true };
}

// --- Maps ----------------------------------------------------------------

export type MapField = "mapName" | "order" | "teamAScore" | "teamBScore" | "note" | "apiMatchId";
export type MapFieldErrors = Partial<Record<MapField, string>>;
export type MapInput = {
  mapName: string;
  order: string;
  teamAScore: string;
  teamBScore: string;
  isCompleted: boolean;
  note: string;
  apiMatchId: string;
};
export type MapResult = { ok: true; id: number } | { ok: false; fieldErrors: MapFieldErrors };

const API_MATCH_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

async function validateMapInput(input: MapInput, currentMapId: number | null): Promise<MapFieldErrors> {
  const fieldErrors: MapFieldErrors = {};
  if (!MAP_OPTIONS.includes(input.mapName as (typeof MAP_OPTIONS)[number])) fieldErrors.mapName = "invalid";

  const order = Number(input.order);
  if (!Number.isInteger(order) || order < 1) fieldErrors.order = "invalid";

  // -1 is V1's forfeit sentinel (no boolean field, cf. reportMatchResult) —
  // valid on either score, just not both at once (a map needs a winner).
  for (const [field, value] of [
    ["teamAScore", input.teamAScore],
    ["teamBScore", input.teamBScore],
  ] as const) {
    if (value.trim() === "") continue;
    const n = Number(value);
    if (!Number.isInteger(n) || n < -1) fieldErrors[field] = "invalid";
  }
  if (input.teamAScore.trim() !== "" && input.teamBScore.trim() !== "" && Number(input.teamAScore) === -1 && Number(input.teamBScore) === -1) {
    fieldErrors.teamAScore = "bothCannotForfeit";
  }

  if (input.note.trim().length > 500) fieldErrors.note = "tooLong";

  const apiMatchId = input.apiMatchId.trim();
  if (apiMatchId !== "") {
    if (!API_MATCH_ID_RE.test(apiMatchId)) {
      fieldErrors.apiMatchId = "invalid";
    } else {
      const conflictCondition = currentMapId !== null ? and(eq(maps.apiMatchId, apiMatchId), ne(maps.id, currentMapId)) : eq(maps.apiMatchId, apiMatchId);
      const [conflict] = await db.select({ id: maps.id }).from(maps).where(conflictCondition).limit(1);
      if (conflict) fieldErrors.apiMatchId = "duplicateMatchId";
    }
  }

  return fieldErrors;
}

function deriveMapIsForfeit(input: MapInput): boolean {
  return Number(input.teamAScore) === -1 || Number(input.teamBScore) === -1;
}

export async function addMap(matchId: number, input: MapInput): Promise<MapResult> {
  await requireTournamentsActor();

  const [match] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return { ok: false, fieldErrors: { mapName: "matchNotFound" } as MapFieldErrors };

  const fieldErrors = await validateMapInput(input, null);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(maps)
    .values({
      matchId,
      mapName: input.mapName,
      order: Number(input.order),
      teamAScore: input.teamAScore.trim() === "" ? null : Number(input.teamAScore),
      teamBScore: input.teamBScore.trim() === "" ? null : Number(input.teamBScore),
      isCompleted: input.isCompleted,
      isForfeit: deriveMapIsForfeit(input),
      note: input.note.trim() || null,
      apiMatchId: input.apiMatchId.trim() || null,
    })
    .returning({ id: maps.id });
  if (!created) throw new Error("Insert returned no row");
  updateTag(matchTag(matchId));

  return { ok: true, id: created.id };
}

export async function updateMap(mapId: number, input: MapInput): Promise<MapResult> {
  await requireTournamentsActor();

  const [existing] = await db.select({ id: maps.id, matchId: maps.matchId }).from(maps).where(eq(maps.id, mapId)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { mapName: "notFound" } as MapFieldErrors };

  const fieldErrors = await validateMapInput(input, mapId);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(maps)
    .set({
      mapName: input.mapName,
      order: Number(input.order),
      teamAScore: input.teamAScore.trim() === "" ? null : Number(input.teamAScore),
      teamBScore: input.teamBScore.trim() === "" ? null : Number(input.teamBScore),
      isCompleted: input.isCompleted,
      isForfeit: deriveMapIsForfeit(input),
      note: input.note.trim() || null,
      apiMatchId: input.apiMatchId.trim() || null,
    })
    .where(eq(maps.id, mapId));
  updateTag(matchTag(existing.matchId));

  return { ok: true, id: mapId };
}

export type DeleteMapResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteMap(mapId: number): Promise<DeleteMapResult> {
  await requireTournamentsActor();

  const [existing] = await db.select({ id: maps.id, matchId: maps.matchId }).from(maps).where(eq(maps.id, mapId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(maps).where(eq(maps.id, mapId));
  updateTag(matchTag(existing.matchId));
  return { ok: true };
}

export type ResetMapResult = { ok: true } | { ok: false; error: "notFound" };

/** V1's "Reset map" (admin.matches.maps.reset) — wipes stats/rounds/score but keeps apiMatchId/mapName so a Fetch can be retried. */
export async function resetMap(mapId: number): Promise<ResetMapResult> {
  await requireTournamentsActor();

  const [existing] = await db.select({ id: maps.id, matchId: maps.matchId }).from(maps).where(eq(maps.id, mapId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.delete(mapPlayerStats).where(eq(mapPlayerStats.mapId, mapId));
    await tx.delete(mapTeamRoundSummary).where(eq(mapTeamRoundSummary.mapId, mapId));
    await tx.delete(mapRoundsRaw).where(eq(mapRoundsRaw.mapId, mapId)); // cascades to kills/loadouts/positions
    await tx.update(maps).set({ teamAScore: null, teamBScore: null, isCompleted: false, isForfeit: false }).where(eq(maps.id, mapId));
  });
  updateTag(matchTag(existing.matchId));

  return { ok: true };
}

// --- Manual scoreboard (no Riot match id available, e.g. old LAN games) ----

export type MapPlayerStatInput = {
  personId: string;
  agentName: string;
  kills: string;
  deaths: string;
  assists: string;
  acs: string;
  adr: string;
  kastPercentage: string;
  firstKills: string;
  firstDeaths: string;
  headshotPercentage: string;
};
export type MapPlayerStatFieldErrors = Record<string, string>;
export type UpdateMapPlayerStatsResult = { ok: true } | { ok: false; error: "notFound" | "entrantsNotSet" } | { ok: false; fieldErrors: MapPlayerStatFieldErrors };

function validatePlayerStatRow(row: MapPlayerStatInput, prefix: string, errors: MapPlayerStatFieldErrors): void {
  const personId = Number(row.personId);
  if (!Number.isInteger(personId) || personId < 1) errors[`${prefix}-personId`] = "required";
  if (!VALORANT_AGENTS.includes(row.agentName as (typeof VALORANT_AGENTS)[number])) errors[`${prefix}-agentName`] = "invalid";

  for (const [field, value] of [
    ["kills", row.kills],
    ["deaths", row.deaths],
    ["assists", row.assists],
    ["acs", row.acs],
    ["adr", row.adr],
    ["firstKills", row.firstKills],
    ["firstDeaths", row.firstDeaths],
  ] as const) {
    const n = Number(value);
    if (value.trim() === "" || !Number.isInteger(n) || n < 0) errors[`${prefix}-${field}`] = "invalid";
  }

  for (const [field, value] of [
    ["kastPercentage", row.kastPercentage],
    ["headshotPercentage", row.headshotPercentage],
  ] as const) {
    const n = Number(value);
    if (value.trim() === "" || Number.isNaN(n) || n < 0 || n > 100) errors[`${prefix}-${field}`] = "invalid";
  }
}

/** Replaces every `map_player_stats` row for this map (idempotent, mirrors the Fetch pipeline's delete+reinsert convention) with the manually entered scoreboard. Used when no Riot match id exists to Fetch from. */
export async function updateMapPlayerStats(mapId: number, playersA: MapPlayerStatInput[], playersB: MapPlayerStatInput[]): Promise<UpdateMapPlayerStatsResult> {
  await requireTournamentsActor();

  const [map] = await db.select({ id: maps.id, matchId: maps.matchId }).from(maps).where(eq(maps.id, mapId)).limit(1);
  if (!map) return { ok: false, error: "notFound" };

  const [match] = await db.select({ entrantAId: matches.entrantAId, entrantBId: matches.entrantBId }).from(matches).where(eq(matches.id, map.matchId)).limit(1);
  if (!match || match.entrantAId === null || match.entrantBId === null) return { ok: false, error: "entrantsNotSet" };

  const fieldErrors: MapPlayerStatFieldErrors = {};
  playersA.forEach((row, i) => validatePlayerStatRow(row, `a-${i}`, fieldErrors));
  playersB.forEach((row, i) => validatePlayerStatRow(row, `b-${i}`, fieldErrors));
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const toRow = (row: MapPlayerStatInput, entrantId: number) => ({
    mapId,
    entrantId,
    personId: Number(row.personId),
    agentName: row.agentName,
    valName: null,
    kills: Number(row.kills),
    deaths: Number(row.deaths),
    assists: Number(row.assists),
    acs: Number(row.acs),
    adr: Number(row.adr),
    kastPercentage: row.kastPercentage,
    firstKills: Number(row.firstKills),
    firstDeaths: Number(row.firstDeaths),
    headshotPercentage: row.headshotPercentage,
  });

  const rowsToInsert = [...playersA.map((row) => toRow(row, match.entrantAId!)), ...playersB.map((row) => toRow(row, match.entrantBId!))];

  await db.transaction(async (tx) => {
    await tx.delete(mapPlayerStats).where(eq(mapPlayerStats.mapId, mapId));
    if (rowsToInsert.length > 0) await tx.insert(mapPlayerStats).values(rowsToInsert);
  });
  updateTag(matchTag(map.matchId));

  return { ok: true };
}

// --- Liquipedia wikicode import --------------------------------------------
// Port of V1's MatchController::importWikicode — paste a {{MapVeto}} +
// {{mapN}} wikicode block, rebuild the veto and the maps from it. Unlike
// the plain veto save (deliberately independent from `maps`, cf. above),
// this action DOES rebuild `maps` — it's the one explicit action whose
// entire purpose is importing map-level data (Riot match ids, skipped
// maps), matching V1 1:1.

export type ImportWikicodeError =
  | "required"
  | "tooLong"
  | "missingTeams"
  | "empty"
  | "unknownMap"
  | "duplicateMatchId"
  | "invalidResolution";

/**
 * The wikicode's opponent name disagrees with the Liquipedia table: either
 * this team is already linked to another name, or this name to another team.
 */
export type LiquipediaImportConflict = {
  slot: 1 | 2;
  teamId: number;
  teamName: string;
  importName: string;
  currentNameForTeam: string | null;
  currentTeamForName: { teamId: number; teamName: string } | null;
};

/** Per slot: keep the table as is, or relink according to the wikicode. */
export type LiquipediaConflictResolution = "keep" | "import";

export type ImportWikicodeResult =
  | { ok: true; linkedNames: number }
  | { ok: false; error: ImportWikicodeError }
  | { ok: false; error: "liquipediaConflict"; conflicts: LiquipediaImportConflict[] };

type LiquipediaLinkPlan = { teamId: number; name: string; conflict: LiquipediaImportConflict | null };

/** Compares the wikicode's opponents with the Liquipedia table, one plan per slot that has both a team and a name. */
async function planLiquipediaLinks(wikicode: string, entrantIds: [number, number]): Promise<LiquipediaLinkPlan[]> {
  const names = parseMatchOpponentNames(wikicode);
  const entrantRows = await db
    .select({ id: entrants.id, teamId: entrants.teamId, teamName: teams.name })
    .from(entrants)
    .innerJoin(teams, eq(teams.id, entrants.teamId))
    .where(inArray(entrants.id, entrantIds));

  const slots: { slot: 1 | 2; teamId: number; teamName: string; name: string }[] = [];
  for (const slot of [1, 2] as const) {
    const name = names[slot];
    const entrant = entrantRows.find((e) => e.id === entrantIds[slot - 1]);
    if (!name || !entrant?.teamId || validateLiquipediaName(name)) continue;
    // Same name on both sides can't be one to one, leave the table alone.
    if (slots.some((s) => s.name.toLowerCase() === name.toLowerCase() || s.teamId === entrant.teamId)) return [];
    slots.push({ slot, teamId: entrant.teamId, teamName: entrant.teamName, name });
  }
  if (slots.length === 0) return [];

  const mappings = await findLiquipediaMappings(
    slots.map((s) => s.teamId),
    slots.map((s) => s.name)
  );
  const plans: LiquipediaLinkPlan[] = [];
  for (const s of slots) {
    const byName = mappings.find((m) => m.name.toLowerCase() === s.name.toLowerCase()) ?? null;
    const byTeam = mappings.find((m) => m.teamId === s.teamId) ?? null;
    if (byName?.teamId === s.teamId) continue;
    const conflict =
      byName || byTeam
        ? {
            slot: s.slot,
            teamId: s.teamId,
            teamName: s.teamName,
            importName: s.name,
            currentNameForTeam: byTeam?.name ?? null,
            currentTeamForName: byName ? { teamId: byName.teamId, teamName: byName.teamName } : null,
          }
        : null;
    plans.push({ teamId: s.teamId, name: s.name, conflict });
  }
  return plans;
}

export async function importMatchWikicode(
  matchId: number,
  wikicode: string,
  resolutions: Partial<Record<"1" | "2", LiquipediaConflictResolution>> = {}
): Promise<ImportWikicodeResult> {
  await requireTournamentsActor();

  const trimmed = wikicode.trim();
  if (!trimmed) return { ok: false, error: "required" };
  if (trimmed.length > 100_000) return { ok: false, error: "tooLong" };

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return { ok: false, error: "missingTeams" };
  if (match.entrantAId === null || match.entrantBId === null) return { ok: false, error: "missingTeams" };

  const veto = parseMapVeto(trimmed, VALORANT_MAP_POOL);
  if (!veto.ok) return { ok: false, error: veto.error };

  const teamIdForSlot = (slot: "1" | "2") => (slot === "1" ? match.entrantAId! : match.entrantBId!);
  const playOrder = veto.rows.filter((r) => r.type === "pick" || r.type === "decider");
  const mapInfoByStep = parseMapTemplates(trimmed);

  const apiMatchIds = [...mapInfoByStep.values()].map((info) => info.apiMatchId).filter((id): id is string => id !== null);
  if (apiMatchIds.length > 0) {
    for (const apiMatchId of apiMatchIds) {
      const [conflict] = await db
        .select({ id: maps.id })
        .from(maps)
        .where(and(eq(maps.apiMatchId, apiMatchId), ne(maps.matchId, matchId)))
        .limit(1);
      if (conflict) return { ok: false, error: "duplicateMatchId" };
    }
  }

  const linkPlans = await planLiquipediaLinks(trimmed, [match.entrantAId, match.entrantBId]);
  const conflicts = linkPlans.map((p) => p.conflict).filter((c): c is LiquipediaImportConflict => c !== null);
  for (const conflict of conflicts) {
    const resolution = resolutions[String(conflict.slot) as "1" | "2"];
    if (resolution === undefined) return { ok: false, error: "liquipediaConflict", conflicts };
    if (resolution !== "keep" && resolution !== "import") return { ok: false, error: "invalidResolution" };
  }
  const linksToWrite = linkPlans.filter((p) => !p.conflict || resolutions[String(p.conflict.slot) as "1" | "2"] === "import");

  await db.transaction(async (tx) => {
    if (linksToWrite.length > 0) {
      await tx
        .delete(liquipediaTeamNames)
        .where(
          or(
            inArray(liquipediaTeamNames.teamId, linksToWrite.map((l) => l.teamId)),
            inArray(sql`lower(${liquipediaTeamNames.name})`, linksToWrite.map((l) => l.name.toLowerCase()))
          )
        );
      await tx.insert(liquipediaTeamNames).values(linksToWrite.map((l) => ({ teamId: l.teamId, name: l.name })));
    }

    await tx.delete(matchVetos).where(eq(matchVetos.matchId, matchId));
    await tx.insert(matchVetos).values(
      veto.rows.map((row, index) => ({
        matchId,
        entrantId: teamIdForSlot(row.teamSlot),
        mapName: row.mapName,
        type: row.type,
        order: index + 1,
        side: null,
        sidePickedByEntrantId: null,
      }))
    );

    await tx.delete(maps).where(eq(maps.matchId, matchId));
    if (playOrder.length > 0) {
      await tx.insert(maps).values(
        playOrder.map((row, index) => {
          const info = mapInfoByStep.get(index + 1);
          const skip = info?.finishedSkip ?? false;
          return {
            matchId,
            mapName: row.mapName,
            order: index + 1,
            apiMatchId: info?.apiMatchId ?? null,
            teamAScore: skip ? -1 : null,
            teamBScore: skip ? -1 : null,
            isCompleted: skip,
            isForfeit: false,
          };
        })
      );
    }
  });
  updateTag(matchTag(matchId));

  return { ok: true, linkedNames: linksToWrite.length };
}
