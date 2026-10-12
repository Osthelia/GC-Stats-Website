/**
 * GC-Stats - admin-liquipedia
 *
 * Admin server actions for the Liquipedia name <-> team table (one Liquipedia
 * page name per team, and vice versa).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, liquipediaTeamNames, liquipediaPersonNames, people, stageContainers, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { findLiquipediaMappings, findLiquipediaPersonMappings, findTeamStaffByLiquipediaName, getTournamentLiquipediaBrackets } from "@/lib/admin-liquipedia";
import { searchPeopleQuery, type PersonPickerResult } from "@/lib/person-search";
import { validateLiquipediaName, type LiquipediaNameError } from "@/lib/liquipedia-name-validation";
import { validateBracketTemplate, type BracketTemplateError } from "@/lib/liquipedia-bracket-wikicode";

export type LiquipediaRowError = { error: LiquipediaNameError | "duplicate" | "nameTaken" | "teamNotInTournament"; teamName?: string };

export type SaveLiquipediaNamesResult =
  | { ok: true; saved: number }
  | { ok: false; error?: "empty" | "tooMany"; rowErrors: Record<number, LiquipediaRowError> };

const MAX_ROWS = 300;

export async function saveLiquipediaTeamNames(tournamentId: number, rows: { teamId: number; name: string }[]): Promise<SaveLiquipediaNamesResult> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);

  if (!Number.isInteger(tournamentId) || !Array.isArray(rows)) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length === 0) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length > MAX_ROWS) return { ok: false, error: "tooMany", rowErrors: {} };

  const rowErrors: Record<number, LiquipediaRowError> = {};
  const cleaned: { teamId: number; name: string }[] = [];
  const seenTeams = new Set<number>();
  const seenNames = new Map<string, number>();

  for (const row of rows) {
    if (!row || !Number.isInteger(row.teamId) || seenTeams.has(row.teamId)) continue;
    seenTeams.add(row.teamId);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const nameError = validateLiquipediaName(name);
    if (nameError) {
      rowErrors[row.teamId] = { error: nameError };
      continue;
    }
    const key = name.toLowerCase();
    const otherTeamId = seenNames.get(key);
    if (otherTeamId !== undefined) {
      rowErrors[row.teamId] = { error: "duplicate" };
      rowErrors[otherTeamId] = { error: "duplicate" };
      continue;
    }
    seenNames.set(key, row.teamId);
    cleaned.push({ teamId: row.teamId, name });
  }

  // Only teams actually registered in this tournament can be completed from its page.
  const teamIds = cleaned.map((r) => r.teamId);
  const registered = teamIds.length
    ? await db
        .select({ teamId: entrants.teamId })
        .from(entrants)
        .where(and(eq(entrants.tournamentId, tournamentId), isNotNull(entrants.teamId), inArray(entrants.teamId, teamIds)))
    : [];
  const registeredIds = new Set(registered.map((r) => r.teamId));
  for (const row of cleaned) if (!registeredIds.has(row.teamId)) rowErrors[row.teamId] = { error: "teamNotInTournament" };

  // A name already held by a team outside this submission stays with it.
  const existing = await findLiquipediaMappings([], cleaned.map((r) => r.name));
  for (const mapping of existing) {
    if (seenTeams.has(mapping.teamId)) continue;
    const row = cleaned.find((r) => r.name.toLowerCase() === mapping.name.toLowerCase());
    if (row) rowErrors[row.teamId] = { error: "nameTaken", teamName: mapping.teamName };
  }

  if (Object.keys(rowErrors).length > 0) return { ok: false, rowErrors };

  try {
    await db.transaction(async (tx) => {
      await tx.delete(liquipediaTeamNames).where(inArray(liquipediaTeamNames.teamId, teamIds));
      await tx.insert(liquipediaTeamNames).values(cleaned.map((r) => ({ teamId: r.teamId, name: r.name })));
    });
  } catch (error) {
    // A concurrent save took one of the names between the check and the insert.
    const raced = await findLiquipediaMappings([], cleaned.map((r) => r.name));
    for (const mapping of raced) {
      if (seenTeams.has(mapping.teamId)) continue;
      const row = cleaned.find((r) => r.name.toLowerCase() === mapping.name.toLowerCase());
      if (row) rowErrors[row.teamId] = { error: "nameTaken", teamName: mapping.teamName };
    }
    if (Object.keys(rowErrors).length === 0) throw error;
    return { ok: false, rowErrors };
  }

  return { ok: true, saved: cleaned.length };
}

export type LiquipediaPersonRowError = { error: LiquipediaNameError | "duplicate" | "nameTaken" | "personNotFound"; teamName?: string };

export type SaveLiquipediaPersonNamesResult =
  | { ok: true; saved: number }
  | { ok: false; error?: "empty" | "tooMany"; rowErrors: Record<number, LiquipediaPersonRowError> };

export async function saveLiquipediaPersonNames(tournamentId: number, rows: { personId: number; name: string }[]): Promise<SaveLiquipediaPersonNamesResult> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);

  if (!Number.isInteger(tournamentId) || !Array.isArray(rows)) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length === 0) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length > MAX_ROWS) return { ok: false, error: "tooMany", rowErrors: {} };

  const rowErrors: Record<number, LiquipediaPersonRowError> = {};
  const cleaned: { personId: number; name: string }[] = [];
  const seenPeople = new Set<number>();
  const seenNames = new Map<string, number>();

  for (const row of rows) {
    if (!row || !Number.isInteger(row.personId) || seenPeople.has(row.personId)) continue;
    seenPeople.add(row.personId);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const nameError = validateLiquipediaName(name);
    if (nameError) {
      rowErrors[row.personId] = { error: nameError };
      continue;
    }
    const key = name.toLowerCase();
    const otherPersonId = seenNames.get(key);
    if (otherPersonId !== undefined) {
      rowErrors[row.personId] = { error: "duplicate" };
      rowErrors[otherPersonId] = { error: "duplicate" };
      continue;
    }
    seenNames.set(key, row.personId);
    cleaned.push({ personId: row.personId, name });
  }

  // Staff are rarely registered on the team, so any existing person can be mapped.
  const personIds = cleaned.map((r) => r.personId);
  const existingIds = new Set(personIds.length ? (await db.select({ id: people.id }).from(people).where(inArray(people.id, personIds))).map((r) => r.id) : []);
  for (const row of cleaned) if (!existingIds.has(row.personId)) rowErrors[row.personId] = { error: "personNotFound" };

  // A name already held by a person outside this submission stays with them.
  const existing = await findLiquipediaPersonMappings([], cleaned.map((r) => r.name));
  for (const mapping of existing) {
    if (seenPeople.has(mapping.personId)) continue;
    const row = cleaned.find((r) => r.name.toLowerCase() === mapping.name.toLowerCase());
    if (row) rowErrors[row.personId] = { error: "nameTaken", teamName: mapping.handle };
  }

  if (Object.keys(rowErrors).length > 0) return { ok: false, rowErrors };

  try {
    await db.transaction(async (tx) => {
      await tx.delete(liquipediaPersonNames).where(inArray(liquipediaPersonNames.personId, personIds));
      await tx.insert(liquipediaPersonNames).values(cleaned.map((r) => ({ personId: r.personId, name: r.name })));
    });
  } catch (error) {
    // A concurrent save took one of the names between the check and the insert.
    const raced = await findLiquipediaPersonMappings([], cleaned.map((r) => r.name));
    for (const mapping of raced) {
      if (seenPeople.has(mapping.personId)) continue;
      const row = cleaned.find((r) => r.name.toLowerCase() === mapping.name.toLowerCase());
      if (row) rowErrors[row.personId] = { error: "nameTaken", teamName: mapping.handle };
    }
    if (Object.keys(rowErrors).length === 0) throw error;
    return { ok: false, rowErrors };
  }

  return { ok: true, saved: cleaned.length };
}

/** Person picker search for the mapping table: with no query, the staff of the line's team come first. */
export async function searchLiquipediaPeople(query: string, liquipediaTeamName: string | null): Promise<PersonPickerResult[]> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
  if (typeof query !== "string" || query.length > 100) return [];
  const staff = !query.trim() && liquipediaTeamName ? await findTeamStaffByLiquipediaName(liquipediaTeamName, 8) : [];
  if (staff.length >= 8) return staff;
  const staffIds = new Set(staff.map((p) => p.id));
  const others = (await searchPeopleQuery(query)).filter((p) => !staffIds.has(p.id));
  return [...staff, ...others].slice(0, 8);
}

export type LiquipediaBracketRowError = { error: BracketTemplateError | "bracketNotInTournament" };

export type SaveLiquipediaBracketTemplatesResult =
  | { ok: true; saved: number }
  | { ok: false; error?: "empty" | "tooMany"; rowErrors: Record<number, LiquipediaBracketRowError> };

/** `rows[].bracketId` is the id of a bracket group's first container (see `getTournamentLiquipediaBrackets`). */
export async function saveLiquipediaBracketTemplates(tournamentId: number, rows: { bracketId: number; template: string }[]): Promise<SaveLiquipediaBracketTemplatesResult> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);

  if (!Number.isInteger(tournamentId) || !Array.isArray(rows)) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length === 0) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length > MAX_ROWS) return { ok: false, error: "tooMany", rowErrors: {} };

  const brackets = new Map((await getTournamentLiquipediaBrackets(tournamentId)).map((b) => [b.id, b]));
  const rowErrors: Record<number, LiquipediaBracketRowError> = {};
  const cleaned: { containerIds: number[]; template: string }[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    if (!row || !Number.isInteger(row.bracketId) || seen.has(row.bracketId)) continue;
    seen.add(row.bracketId);
    const bracket = brackets.get(row.bracketId);
    if (!bracket) {
      rowErrors[row.bracketId] = { error: "bracketNotInTournament" };
      continue;
    }
    const template = typeof row.template === "string" ? row.template.trim() : "";
    const error = validateBracketTemplate(template);
    if (error) {
      rowErrors[row.bracketId] = { error };
      continue;
    }
    cleaned.push({ containerIds: bracket.containerIds, template });
  }

  if (Object.keys(rowErrors).length > 0) return { ok: false, rowErrors };

  await db.transaction(async (tx) => {
    for (const row of cleaned) {
      await tx.update(stageContainers).set({ liquipediaBracketTemplate: row.template }).where(inArray(stageContainers.id, row.containerIds));
    }
  });

  return { ok: true, saved: cleaned.length };
}
