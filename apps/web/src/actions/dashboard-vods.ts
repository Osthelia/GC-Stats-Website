/**
 * GC-Stats - dashboard-vods
 *
 * Dashboard server actions for an organization to link VOD URLs to a
 * tournament match/map, gated by the vodsLink permission.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { newsLanguages, ORGANIZATION_PERMISSIONS, gameTables } from "@gc-stats/db";
import { requireDashboardOrgActorPermission } from "@/lib/dashboard-rbac";
import { isValidUrl } from "@/lib/admin-validation";
import { logActivity, diffChanges } from "@/lib/activity-log";
import { searchTournamentsQuery, type TournamentPickerResult } from "@/lib/tournament-search";
import { getMatchTournamentId, getTournamentMatchOptionsForCredit, type CreditMatchOption } from "@/lib/production-credits-data";
import { getMatchMapOptions, type MatchMapOption } from "@/lib/dashboard-vods-data";
import { listMapRefs } from "@/lib/series-map-refs";
import { gameHasMaps, type GameSlug } from "@gc-stats/db/game";

export type { CreditMatchOption } from "@/lib/production-credits-data";
export type { MatchMapOption } from "@/lib/dashboard-vods-data";

async function isActiveLanguage(code: string): Promise<boolean> {
  const [row] = await db.select({ code: newsLanguages.code }).from(newsLanguages).where(and(eq(newsLanguages.code, code), eq(newsLanguages.isActive, true))).limit(1);
  return !!row;
}

/** Same search as the production-credits tournament picker, gated by this organization's vodsLink permission instead. */
export async function searchTournamentsForVod(game: GameSlug, organizationId: number, query: string): Promise<TournamentPickerResult[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);
  return searchTournamentsQuery(game, query);
}

export async function getMatchOptionsForVod(game: GameSlug, organizationId: number, tournamentId: number): Promise<CreditMatchOption[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);
  return getTournamentMatchOptionsForCredit(game, tournamentId);
}

export async function getMapOptionsForVod(game: GameSlug, organizationId: number, matchId: number): Promise<MatchMapOption[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);
  return getMatchMapOptions(game, matchId);
}

export type VodField = "tournament" | "match" | "map" | "url" | "languageCode";
export type VodFieldErrors = Partial<Record<VodField, string>>;
export type AddVodInput = { tournamentId: number | null; matchId: number | null; mapId: number | null; url: string; languageCode: string };

export type AddVodResult = { ok: true; id: number } | { ok: false; fieldErrors: VodFieldErrors };

export async function addVod(game: GameSlug, organizationId: number, input: AddVodInput): Promise<AddVodResult> {
  const { vods } = gameTables(game);
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);

  const fieldErrors: VodFieldErrors = {};
  if (!input.tournamentId) fieldErrors.tournament = "required";
  if (!input.matchId) fieldErrors.match = "required";
  if (!input.url.trim()) fieldErrors.url = "required";
  else if (!isValidUrl(input.url.trim())) fieldErrors.url = "invalidUrl";
  if (!input.languageCode) fieldErrors.languageCode = "required";
  else if (!(await isActiveLanguage(input.languageCode))) fieldErrors.languageCode = "invalidLanguage";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const matchTournamentId = await getMatchTournamentId(game, input.matchId as number);
  if (matchTournamentId === null) return { ok: false, fieldErrors: { match: "matchNotFound" } };
  if (matchTournamentId !== input.tournamentId) return { ok: false, fieldErrors: { match: "matchNotInTournament" } };

  if (input.mapId !== null) {
    const [map] = await listMapRefs(db, game, [input.mapId]);
    // The error names the unit the form shows: "map" for Valorant, "game" for LoL.
    const unit = gameHasMaps(game) ? "map" : "game";
    if (!map) return { ok: false, fieldErrors: { map: `${unit}NotFound` } };
    if (map.matchId !== input.matchId) return { ok: false, fieldErrors: { map: `${unit}NotInMatch` } };
  }

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(vods)
      .values({ matchId: input.matchId as number, mapId: input.mapId, organizationId, url: input.url.trim(), languageCode: input.languageCode })
      .returning({ id: vods.id });
    if (!created) throw new Error("Insert returned no row");
    await logActivity({ subject: "vod", subjectId: created.id, event: "created", description: `Created VOD #${created.id} on match #${input.matchId}`, actorUserId, properties: { organizationId, matchId: input.matchId, mapId: input.mapId } }, tx);
    return created.id;
  });
  return { ok: true, id };
}

export type UpdateVodInput = { url: string; languageCode: string };
export type UpdateVodResult = { ok: true } | { ok: false; fieldErrors: VodFieldErrors; error?: "notFound" };

export async function updateVod(game: GameSlug, organizationId: number, vodId: number, input: UpdateVodInput): Promise<UpdateVodResult> {
  const { vods } = gameTables(game);
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);

  const [existing] = await db.select().from(vods).where(eq(vods.id, vodId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, fieldErrors: {}, error: "notFound" };

  const fieldErrors: VodFieldErrors = {};
  if (!input.url.trim()) fieldErrors.url = "required";
  else if (!isValidUrl(input.url.trim())) fieldErrors.url = "invalidUrl";
  if (!input.languageCode) fieldErrors.languageCode = "required";
  else if (!(await isActiveLanguage(input.languageCode))) fieldErrors.languageCode = "invalidLanguage";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const values = { url: input.url.trim(), languageCode: input.languageCode };
  await db.transaction(async (tx) => {
    await tx.update(vods).set(values).where(eq(vods.id, vodId));
    const changes = diffChanges(existing, values);
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "vod", subjectId: vodId, event: "updated", description: `Updated VOD #${vodId}`, actorUserId, changes, properties: { organizationId, matchId: existing.matchId } }, tx);
    }
  });
  return { ok: true };
}

export type DeleteVodResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteVod(game: GameSlug, organizationId: number, vodId: number): Promise<DeleteVodResult> {
  const { vods } = gameTables(game);
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);

  const [existing] = await db.select({ organizationId: vods.organizationId, matchId: vods.matchId }).from(vods).where(eq(vods.id, vodId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.delete(vods).where(eq(vods.id, vodId));
    await logActivity({ subject: "vod", subjectId: vodId, event: "deleted", description: `Deleted VOD #${vodId}`, actorUserId, properties: { organizationId, matchId: existing.matchId } }, tx);
  });
  return { ok: true };
}
