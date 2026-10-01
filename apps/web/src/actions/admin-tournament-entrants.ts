/**
 * GC-Stats - admin-tournament-entrants
 *
 * Admin server actions for a tournament's entrant list: registering teams
 * or placeholder entrants with seeds, preventing duplicate registration.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, ne } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, teams, tournaments, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

export type EntrantField = "kind" | "teamId" | "displayName" | "seed";
export type EntrantFieldErrors = Partial<Record<EntrantField, string>>;
export type EntrantResult = { ok: true; id: number } | { ok: false; fieldErrors: EntrantFieldErrors };

export type EntrantInput = {
  kind: "team" | "placeholder";
  teamId: number | null;
  displayName: string;
  seed: number | null;
};

async function validateEntrant(tournamentId: number, input: EntrantInput, excludeId?: number): Promise<EntrantFieldErrors> {
  const fieldErrors: EntrantFieldErrors = {};

  if (input.kind !== "team" && input.kind !== "placeholder") fieldErrors.kind = "invalid";

  if (input.kind === "team") {
    if (input.teamId === null) fieldErrors.teamId = "required";
    else {
      const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, input.teamId)).limit(1);
      if (!team) fieldErrors.teamId = "notFound";
      else {
        const conditions = [eq(entrants.tournamentId, tournamentId), eq(entrants.teamId, input.teamId)];
        if (excludeId !== undefined) conditions.push(ne(entrants.id, excludeId));
        const [existing] = await db
          .select({ id: entrants.id })
          .from(entrants)
          .where(and(...conditions))
          .limit(1);
        if (existing) fieldErrors.teamId = "alreadyRegistered";
      }
    }
  }

  const displayName = input.displayName.trim();
  if (!displayName) fieldErrors.displayName = "required";
  else if (displayName.length > 255) fieldErrors.displayName = "tooLong";

  if (input.seed !== null) {
    if (!Number.isInteger(input.seed) || input.seed < 1) fieldErrors.seed = "invalid";
    else {
      const conditions = [eq(entrants.tournamentId, tournamentId), eq(entrants.seed, input.seed)];
      if (excludeId !== undefined) conditions.push(ne(entrants.id, excludeId));
      const [existing] = await db
        .select({ id: entrants.id })
        .from(entrants)
        .where(and(...conditions))
        .limit(1);
      if (existing) fieldErrors.seed = "duplicateSeed";
    }
  }

  return fieldErrors;
}

export async function addEntrant(tournamentId: number, input: EntrantInput): Promise<EntrantResult> {
  await requireTournamentsActor();

  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return { ok: false, fieldErrors: { displayName: "tournamentNotFound" } };

  const fieldErrors = await validateEntrant(tournamentId, input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(entrants)
    .values({
      tournamentId,
      kind: input.kind,
      teamId: input.kind === "team" ? input.teamId : null,
      displayName: input.displayName.trim(),
      seed: input.seed,
    })
    .returning({ id: entrants.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

export async function updateEntrant(id: number, tournamentId: number, input: EntrantInput): Promise<EntrantResult> {
  await requireTournamentsActor();

  const [existingRow] = await db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.id, id), eq(entrants.tournamentId, tournamentId))).limit(1);
  if (!existingRow) return { ok: false, fieldErrors: { displayName: "notFound" } };

  const fieldErrors = await validateEntrant(tournamentId, input, id);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(entrants)
    .set({
      kind: input.kind,
      teamId: input.kind === "team" ? input.teamId : null,
      displayName: input.displayName.trim(),
      seed: input.seed,
    })
    .where(eq(entrants.id, id));

  return { ok: true, id };
}

export type QuickAddResult = { ok: true; id: number } | { ok: false; error: string };

/**
 * V1-style quick add (see SUIVI.md, tournament-team-picker Livewire
 * component): select a team, it's attached immediately — no dialog, no
 * per-field validation UI, no redirect. Still permission-gated and still
 * checks the two things that would otherwise corrupt state silently
 * (tournament/team existence, duplicate attach).
 */
export async function quickAttachTeamEntrant(tournamentId: number, teamId: number): Promise<QuickAddResult> {
  await requireTournamentsActor();

  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return { ok: false, error: "tournamentNotFound" };

  const [team] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { ok: false, error: "teamNotFound" };

  const [existing] = await db
    .select({ id: entrants.id })
    .from(entrants)
    .where(and(eq(entrants.tournamentId, tournamentId), eq(entrants.teamId, teamId)))
    .limit(1);
  if (existing) return { ok: false, error: "alreadyRegistered" };

  const [created] = await db
    .insert(entrants)
    .values({ tournamentId, kind: "team", teamId, displayName: team.name, seed: null })
    .returning({ id: entrants.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

/** Same V1 shortcut as above, but for a team that doesn't exist yet — creates a bare team (name only) and attaches it in one step. */
export async function quickCreateTeamEntrant(tournamentId: number, name: string): Promise<QuickAddResult> {
  await requireTournamentsActor();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "required" };
  if (trimmed.length > 255) return { ok: false, error: "tooLong" };

  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return { ok: false, error: "tournamentNotFound" };

  const created = await db.transaction(async (tx) => {
    const [team] = await tx.insert(teams).values({ name: trimmed, socials: {}, isActive: true }).returning({ id: teams.id });
    if (!team) throw new Error("Insert returned no row");
    const [entrant] = await tx.insert(entrants).values({ tournamentId, kind: "team", teamId: team.id, displayName: trimmed, seed: null }).returning({ id: entrants.id });
    if (!entrant) throw new Error("Insert returned no row");
    return entrant;
  });

  return { ok: true, id: created.id };
}

export type RemoveEntrantResult = { ok: true } | { ok: false; error: "notFound" | "inUse" };

export async function removeEntrant(id: number, tournamentId: number): Promise<RemoveEntrantResult> {
  await requireTournamentsActor();

  const [existing] = await db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.id, id), eq(entrants.tournamentId, tournamentId))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await db.delete(entrants).where(eq(entrants.id, id));
  } catch (err) {
    const code = (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23503") return { ok: false, error: "inUse" };
    throw err;
  }
  return { ok: true };
}
