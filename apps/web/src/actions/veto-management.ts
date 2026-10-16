/**
 * GC-Stats - veto-management
 *
 * Server actions managing the live veto of a tournament: activation (site
 * admin), settings, map pools, team links and resets (site admin or the
 * organizer's dashboard).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { ORGANIZATION_PERMISSIONS, PERMISSIONS, gameTables, valorantTablesOf } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { requireDashboardOrgActorPermission } from "@/lib/dashboard-rbac";
import { logActivity } from "@/lib/activity-log";
import { VALORANT_MAP_POOL } from "@/lib/valorant-maps";
import { requiredPoolSize } from "@/lib/veto/engine";
import { ensureVetoTokens, getVetoSettings, mapPoolFromPatch, regenerateVetoToken, resetVeto, type FirstMoverMode } from "@/lib/veto/service";
import type { GameSlug } from "@gc-stats/db/game";

/** Site admins act on any tournament, an organizer only on those its organization organizes. */
type VetoScope = { organizationId?: number };

const POOL_SIZE = requiredPoolSize(1);
const FIRST_MOVER_MODES: readonly FirstMoverMode[] = ["coin_toss", "coin_toss_winner", "advantage", "predefined"];
const MIN_TIMEOUT = 10;
const MAX_TIMEOUT = 600;
const PATCH_PATTERN = /^\d{1,3}(\.\d{1,3}){1,2}$/;

async function requireVetoActor(game: GameSlug, tournamentId: number, scope: VetoScope): Promise<string> {
  const { tournaments } = gameTables(game);
  if (scope.organizationId === undefined) return (await requireActorPermission(PERMISSIONS.tournamentsManage, game)).userId;
  const { userId } = await requireDashboardOrgActorPermission(scope.organizationId, ORGANIZATION_PERMISSIONS.vetoManage);
  const [tournament] = await db.select({ organizerOrganizationId: tournaments.organizerOrganizationId }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (tournament?.organizerOrganizationId !== scope.organizationId) throw new Error("Not authorized");
  return userId;
}

async function matchTournamentId(game: GameSlug, matchId: number): Promise<number | null> {
  const { matches, stageContainers, stages } = gameTables(game);
  const [row] = await db
    .select({ tournamentId: stages.tournamentId })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(matches.id, matchId))
    .limit(1);
  return row?.tournamentId ?? null;
}

function validatePool(maps: string[]): "invalidMap" | "duplicateMap" | "poolSize" | null {
  const known = VALORANT_MAP_POOL as readonly string[];
  if (maps.some((m) => !known.includes(m))) return "invalidMap";
  if (new Set(maps).size !== maps.length) return "duplicateMap";
  if (maps.length !== POOL_SIZE) return "poolSize";
  return null;
}

export type VetoToggleResult = { ok: true } | { ok: false; error: "notFound" };

/** Site admin only: an organizer cannot enable the veto for itself. */
export async function setTournamentVetoEnabled(game: GameSlug, tournamentId: number, enabled: boolean): Promise<VetoToggleResult> {
  const { tournaments } = gameTables(game);
  const { userId: actorUserId } = await requireActorPermission(PERMISSIONS.tournamentsManage, game);
  const [tournament] = await db.select({ id: tournaments.id, vetoEnabled: tournaments.vetoEnabled }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return { ok: false, error: "notFound" };
  if (tournament.vetoEnabled === enabled) return { ok: true };

  await db.update(tournaments).set({ vetoEnabled: enabled }).where(eq(tournaments.id, tournamentId));
  if (enabled) await ensureVetoTokens(game, tournamentId);
  await logActivity({ subject: "tournament", subjectId: tournamentId, event: "updated", description: `${enabled ? "Enabled" : "Disabled"} the live veto of tournament #${tournamentId}`, actorUserId });
  return { ok: true };
}

export type VetoSettingsField = "firstMoverMode" | "advantageEntrantId" | "predefinedSlot" | "actionTimeoutSeconds" | "mapPool" | "mapPoolPatch";
export type VetoSettingsFieldErrors = Partial<Record<VetoSettingsField, string>>;
export type VetoSettingsInput = {
  firstMoverMode: string;
  advantageEntrantId: number | null;
  predefinedSlot: string;
  actionTimeoutSeconds: string;
  mapPool: string[];
  mapPoolPatch: string;
};
export type VetoSettingsResult = { ok: true } | { ok: false; fieldErrors: VetoSettingsFieldErrors };

export async function saveVetoSettings(game: GameSlug, tournamentId: number, input: VetoSettingsInput, scope: VetoScope = {}): Promise<VetoSettingsResult> {
  const { entrants, matches } = gameTables(game);
  const { matchVetoSessions, tournamentVetoSettings } = valorantTablesOf(game);
  const actorUserId = await requireVetoActor(game, tournamentId, scope);
  const fieldErrors: VetoSettingsFieldErrors = {};

  if (!(FIRST_MOVER_MODES as readonly string[]).includes(input.firstMoverMode)) fieldErrors.firstMoverMode = "invalid";

  let advantageEntrantId: number | null = null;
  if (input.firstMoverMode === "advantage") {
    if (input.advantageEntrantId === null) fieldErrors.advantageEntrantId = "required";
    else {
      const [entrant] = await db
        .select({ id: entrants.id })
        .from(entrants)
        .where(and(eq(entrants.id, input.advantageEntrantId), eq(entrants.tournamentId, tournamentId)))
        .limit(1);
      if (entrant) advantageEntrantId = entrant.id;
      else fieldErrors.advantageEntrantId = "invalid";
    }
  }

  if (input.predefinedSlot !== "a" && input.predefinedSlot !== "b") fieldErrors.predefinedSlot = "invalid";

  const timeout = Number(input.actionTimeoutSeconds);
  if (input.actionTimeoutSeconds.trim() === "") fieldErrors.actionTimeoutSeconds = "required";
  else if (!Number.isInteger(timeout)) fieldErrors.actionTimeoutSeconds = "notInteger";
  else if (timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT) fieldErrors.actionTimeoutSeconds = "outOfRange";

  const patch = input.mapPoolPatch.trim();
  if (input.mapPool.length > 0) {
    const poolError = validatePool(input.mapPool);
    if (poolError) fieldErrors.mapPool = poolError;
  } else if (!patch) {
    fieldErrors.mapPool = "required";
  } else if (!PATCH_PATTERN.test(patch)) {
    fieldErrors.mapPoolPatch = "invalidPatch";
  } else if ((await mapPoolFromPatch(game, patch)).length !== POOL_SIZE) {
    fieldErrors.mapPoolPatch = "patchUnknown";
  }

  if (Object.keys(fieldErrors).length === 0) {
    // The pool of a veto in progress must not move under the teams.
    const current = await getVetoSettings(tournamentId);
    const poolChanged = JSON.stringify(current.mapPool) !== JSON.stringify(input.mapPool) || (current.mapPoolPatch ?? "") !== (input.mapPool.length > 0 ? "" : patch);
    if (poolChanged) {
      const [running] = await db
        .select({ matchId: matchVetoSessions.matchId })
        .from(matchVetoSessions)
        .innerJoin(matches, eq(matches.id, matchVetoSessions.matchId))
        .innerJoin(entrants, eq(entrants.id, matches.entrantAId))
        .where(and(eq(entrants.tournamentId, tournamentId), inArray(matchVetoSessions.status, ["choosing", "running"])))
        .limit(1);
      if (running) fieldErrors.mapPool = "vetoRunning";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const values = {
    firstMoverMode: input.firstMoverMode,
    advantageEntrantId,
    predefinedSlot: input.predefinedSlot,
    actionTimeoutSeconds: timeout,
    mapPool: input.mapPool,
    mapPoolPatch: input.mapPool.length > 0 ? null : patch,
  };
  await db.insert(tournamentVetoSettings).values({ tournamentId, ...values }).onConflictDoUpdate({ target: tournamentVetoSettings.tournamentId, set: values });
  await logActivity({ subject: "tournament", subjectId: tournamentId, event: "updated", description: `Saved the veto settings of tournament #${tournamentId}`, actorUserId: actorUserId, properties: { section: "veto", organizationId: scope.organizationId } });
  return { ok: true };
}

export type MatchPoolResult = { ok: true } | { ok: false; error: "notFound" | "invalidMap" | "duplicateMap" | "poolSize" | "vetoStarted" };

/** Pool of one match, an empty list goes back to the tournament pool. */
export async function saveMatchVetoPool(game: GameSlug, tournamentId: number, matchId: number, mapPool: string[], scope: VetoScope = {}): Promise<MatchPoolResult> {
  const { matchVetoSessions } = valorantTablesOf(game);
  const actorUserId = await requireVetoActor(game, tournamentId, scope);
  if ((await matchTournamentId(game, matchId)) !== tournamentId) return { ok: false, error: "notFound" };
  if (mapPool.length > 0) {
    const poolError = validatePool(mapPool);
    if (poolError) return { ok: false, error: poolError };
  }

  const [session] = await db.select({ status: matchVetoSessions.status }).from(matchVetoSessions).where(eq(matchVetoSessions.matchId, matchId)).limit(1);
  if (session && session.status !== "waiting") return { ok: false, error: "vetoStarted" };

  await db.insert(matchVetoSessions).values({ matchId, mapPool }).onConflictDoUpdate({ target: matchVetoSessions.matchId, set: { mapPool, updatedAt: new Date() } });
  await logActivity({ subject: "match", subjectId: matchId, event: "updated", description: `Saved the veto map pool of match #${matchId}`, actorUserId: actorUserId, properties: { section: "veto", mapPool } });
  return { ok: true };
}

export type RegenerateLinkResult = { ok: true; token: string } | { ok: false; error: "notFound" };

export async function regenerateTeamVetoLink(game: GameSlug, tournamentId: number, entrantId: number, scope: VetoScope = {}): Promise<RegenerateLinkResult> {
  const { entrants } = gameTables(game);
  const actorUserId = await requireVetoActor(game, tournamentId, scope);
  const [entrant] = await db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.id, entrantId), eq(entrants.tournamentId, tournamentId))).limit(1);
  if (!entrant) return { ok: false, error: "notFound" };

  const token = await regenerateVetoToken(game, entrantId);
  await logActivity({ subject: "tournament", subjectId: tournamentId, event: "updated", description: `Regenerated the veto link of entrant #${entrantId}`, actorUserId: actorUserId, properties: { section: "veto", entrantId } });
  return { ok: true, token };
}

export type ResetVetoResult = { ok: true } | { ok: false; error: "notFound" };

export async function resetMatchVeto(game: GameSlug, tournamentId: number, matchId: number, scope: VetoScope = {}): Promise<ResetVetoResult> {
  const actorUserId = await requireVetoActor(game, tournamentId, scope);
  if ((await matchTournamentId(game, matchId)) !== tournamentId) return { ok: false, error: "notFound" };

  await resetVeto(matchId);
  await logActivity({ subject: "match", subjectId: matchId, event: "updated", description: `Reset the live veto of match #${matchId}`, actorUserId: actorUserId, properties: { section: "veto" } });
  return { ok: true };
}
