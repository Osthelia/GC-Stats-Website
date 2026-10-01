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
import { vods, maps, newsLanguages, ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgActorPermission } from "@/lib/dashboard-rbac";
import { isValidUrl } from "@/lib/admin-validation";
import { searchTournamentsQuery, type TournamentPickerResult } from "@/lib/tournament-search";
import { getMatchTournamentId, getTournamentMatchOptionsForCredit, type CreditMatchOption } from "@/lib/production-credits-data";
import { getMatchMapOptions, type MatchMapOption } from "@/lib/dashboard-vods-data";

export type { CreditMatchOption } from "@/lib/production-credits-data";
export type { MatchMapOption } from "@/lib/dashboard-vods-data";

async function isActiveLanguage(code: string): Promise<boolean> {
  const [row] = await db.select({ code: newsLanguages.code }).from(newsLanguages).where(and(eq(newsLanguages.code, code), eq(newsLanguages.isActive, true))).limit(1);
  return !!row;
}

/** Same search as the production-credits tournament picker, gated by this organization's vodsLink permission instead. */
export async function searchTournamentsForVod(organizationId: number, query: string): Promise<TournamentPickerResult[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);
  return searchTournamentsQuery(query);
}

export async function getMatchOptionsForVod(organizationId: number, tournamentId: number): Promise<CreditMatchOption[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);
  return getTournamentMatchOptionsForCredit(tournamentId);
}

export async function getMapOptionsForVod(organizationId: number, matchId: number): Promise<MatchMapOption[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);
  return getMatchMapOptions(matchId);
}

export type VodField = "tournament" | "match" | "map" | "url" | "languageCode";
export type VodFieldErrors = Partial<Record<VodField, string>>;
export type AddVodInput = { tournamentId: number | null; matchId: number | null; mapId: number | null; url: string; languageCode: string };

export type AddVodResult = { ok: true; id: number } | { ok: false; fieldErrors: VodFieldErrors };

export async function addVod(organizationId: number, input: AddVodInput): Promise<AddVodResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);

  const fieldErrors: VodFieldErrors = {};
  if (!input.tournamentId) fieldErrors.tournament = "required";
  if (!input.matchId) fieldErrors.match = "required";
  if (!input.url.trim()) fieldErrors.url = "required";
  else if (!isValidUrl(input.url.trim())) fieldErrors.url = "invalidUrl";
  if (!input.languageCode) fieldErrors.languageCode = "required";
  else if (!(await isActiveLanguage(input.languageCode))) fieldErrors.languageCode = "invalidLanguage";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const matchTournamentId = await getMatchTournamentId(input.matchId as number);
  if (matchTournamentId === null) return { ok: false, fieldErrors: { match: "matchNotFound" } };
  if (matchTournamentId !== input.tournamentId) return { ok: false, fieldErrors: { match: "matchNotInTournament" } };

  if (input.mapId !== null) {
    const [map] = await db.select({ matchId: maps.matchId }).from(maps).where(eq(maps.id, input.mapId)).limit(1);
    if (!map) return { ok: false, fieldErrors: { map: "mapNotFound" } };
    if (map.matchId !== input.matchId) return { ok: false, fieldErrors: { map: "mapNotInMatch" } };
  }

  const [created] = await db
    .insert(vods)
    .values({ matchId: input.matchId as number, mapId: input.mapId, organizationId, url: input.url.trim(), languageCode: input.languageCode })
    .returning({ id: vods.id });
  if (!created) throw new Error("Insert returned no row");
  return { ok: true, id: created.id };
}

export type UpdateVodInput = { url: string; languageCode: string };
export type UpdateVodResult = { ok: true } | { ok: false; fieldErrors: VodFieldErrors; error?: "notFound" };

export async function updateVod(organizationId: number, vodId: number, input: UpdateVodInput): Promise<UpdateVodResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);

  const [existing] = await db.select({ organizationId: vods.organizationId }).from(vods).where(eq(vods.id, vodId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, fieldErrors: {}, error: "notFound" };

  const fieldErrors: VodFieldErrors = {};
  if (!input.url.trim()) fieldErrors.url = "required";
  else if (!isValidUrl(input.url.trim())) fieldErrors.url = "invalidUrl";
  if (!input.languageCode) fieldErrors.languageCode = "required";
  else if (!(await isActiveLanguage(input.languageCode))) fieldErrors.languageCode = "invalidLanguage";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.update(vods).set({ url: input.url.trim(), languageCode: input.languageCode }).where(eq(vods.id, vodId));
  return { ok: true };
}

export type DeleteVodResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteVod(organizationId: number, vodId: number): Promise<DeleteVodResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.vodsLink);

  const [existing] = await db.select({ organizationId: vods.organizationId }).from(vods).where(eq(vods.id, vodId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, error: "notFound" };

  await db.delete(vods).where(eq(vods.id, vodId));
  return { ok: true };
}
