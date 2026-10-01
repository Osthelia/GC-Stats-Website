/**
 * GC-Stats - dashboard-streams
 *
 * Dashboard server actions for an organization's stream channels and
 * match to stream channel assignments.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { streamChannels, matchStreams, matches, stageContainers, stages, newsLanguages, ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgActorPermission } from "@/lib/dashboard-rbac";
import { isValidUrl } from "@/lib/admin-validation";
import { STREAM_PLATFORMS, STREAM_CHANNEL_TYPES } from "@/lib/stream-platforms";
import { searchTournamentsQuery, type TournamentPickerResult } from "@/lib/tournament-search";
import { getMatchTournamentId, getTournamentMatchOptionsForCredit, type CreditMatchOption } from "@/lib/production-credits-data";

export type { CreditMatchOption } from "@/lib/production-credits-data";

async function isActiveLanguage(code: string): Promise<boolean> {
  const [row] = await db.select({ code: newsLanguages.code }).from(newsLanguages).where(and(eq(newsLanguages.code, code), eq(newsLanguages.isActive, true))).limit(1);
  return !!row;
}

export type StreamChannelField = "name" | "platform" | "type" | "url" | "languageCode";
export type StreamChannelFieldErrors = Partial<Record<StreamChannelField, string>>;
export type StreamChannelInput = { name: string; platform: string; type: string; url: string; languageCode: string; isActive: boolean };

async function validateChannelInput(input: StreamChannelInput): Promise<{ fieldErrors: StreamChannelFieldErrors; name: string }> {
  const fieldErrors: StreamChannelFieldErrors = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 100) fieldErrors.name = "tooLong";

  if (!(STREAM_PLATFORMS as readonly string[]).includes(input.platform)) fieldErrors.platform = "invalidPlatform";

  if (!(STREAM_CHANNEL_TYPES as readonly string[]).includes(input.type)) fieldErrors.type = "invalidType";

  if (!input.url.trim()) fieldErrors.url = "required";
  else if (!isValidUrl(input.url.trim())) fieldErrors.url = "invalidUrl";

  if (!input.languageCode) fieldErrors.languageCode = "required";
  else if (!(await isActiveLanguage(input.languageCode))) fieldErrors.languageCode = "invalidLanguage";

  return { fieldErrors, name };
}

export type StreamChannelResult = { ok: true; id: number } | { ok: false; fieldErrors: StreamChannelFieldErrors };

export async function createStreamChannel(organizationId: number, input: StreamChannelInput): Promise<StreamChannelResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.streamsEdit);

  const { fieldErrors, name } = await validateChannelInput(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(streamChannels)
    .values({ organizationId, name, platform: input.platform, type: input.type, url: input.url.trim(), languageCode: input.languageCode, isActive: input.isActive })
    .returning({ id: streamChannels.id });
  if (!created) throw new Error("Insert returned no row");
  return { ok: true, id: created.id };
}

export type UpdateStreamChannelResult = { ok: true } | { ok: false; fieldErrors: StreamChannelFieldErrors; error?: "notFound" };

export async function updateStreamChannel(organizationId: number, channelId: number, input: StreamChannelInput): Promise<UpdateStreamChannelResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.streamsEdit);

  const [existing] = await db.select({ organizationId: streamChannels.organizationId }).from(streamChannels).where(eq(streamChannels.id, channelId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, fieldErrors: {}, error: "notFound" };

  const { fieldErrors, name } = await validateChannelInput(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.update(streamChannels).set({ name, platform: input.platform, type: input.type, url: input.url.trim(), languageCode: input.languageCode, isActive: input.isActive }).where(eq(streamChannels.id, channelId));
  return { ok: true };
}

export type DeleteStreamChannelResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteStreamChannel(organizationId: number, channelId: number): Promise<DeleteStreamChannelResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.streamsDelete);

  const [existing] = await db.select({ organizationId: streamChannels.organizationId }).from(streamChannels).where(eq(streamChannels.id, channelId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, error: "notFound" };

  await db.delete(streamChannels).where(eq(streamChannels.id, channelId));
  return { ok: true };
}

/** Same search as the production-credits tournament picker, gated by this organization's streamsLink permission instead. */
export async function searchTournamentsForStreamLink(organizationId: number, query: string): Promise<TournamentPickerResult[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.streamsLink);
  return searchTournamentsQuery(query);
}

export async function getMatchOptionsForStreamLink(organizationId: number, tournamentId: number): Promise<CreditMatchOption[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.streamsLink);
  return getTournamentMatchOptionsForCredit(tournamentId);
}

export type LinkStreamResult = { ok: true } | { ok: false; error: "channelNotFound" | "matchNotFound" | "matchNotInTournament" | "alreadyLinked" };

export async function linkStreamChannelToMatch(organizationId: number, channelId: number, tournamentId: number, matchId: number): Promise<LinkStreamResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.streamsLink);

  const [channel] = await db.select({ organizationId: streamChannels.organizationId }).from(streamChannels).where(eq(streamChannels.id, channelId)).limit(1);
  if (!channel || channel.organizationId !== organizationId) return { ok: false, error: "channelNotFound" };

  const matchTournamentId = await getMatchTournamentId(matchId);
  if (matchTournamentId === null) return { ok: false, error: "matchNotFound" };
  if (matchTournamentId !== tournamentId) return { ok: false, error: "matchNotInTournament" };

  const [existing] = await db.select().from(matchStreams).where(and(eq(matchStreams.matchId, matchId), eq(matchStreams.streamChannelId, channelId))).limit(1);
  if (existing) return { ok: false, error: "alreadyLinked" };

  await db.insert(matchStreams).values({ matchId, streamChannelId: channelId });
  return { ok: true };
}

export type LinkManyStreamResult = { ok: true; linked: number; alreadyLinked: number } | { ok: false; error: "channelNotFound" };

/**
 * Batch sibling of linkStreamChannelToMatch — links one channel to every
 * match in matchIds in one submit (mirrors V1's MatchStreamController::linkMany,
 * see admin/streams/matches/create.blade.php), for the "link this channel to
 * a whole batch of a tournament's matches at once" flow. Skips (doesn't
 * fail on) matches already linked or that turn out not to belong to this
 * tournament, since the caller only ever passes matchIds it already fetched
 * for this exact tournament.
 */
export async function linkStreamChannelToMatches(organizationId: number, channelId: number, tournamentId: number, matchIds: number[]): Promise<LinkManyStreamResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.streamsLink);

  const [channel] = await db.select({ organizationId: streamChannels.organizationId }).from(streamChannels).where(eq(streamChannels.id, channelId)).limit(1);
  if (!channel || channel.organizationId !== organizationId) return { ok: false, error: "channelNotFound" };

  if (matchIds.length === 0) return { ok: true, linked: 0, alreadyLinked: 0 };

  const tournamentMatchRows = await db
    .select({ matchId: matches.id })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(inArray(matches.id, matchIds), eq(stages.tournamentId, tournamentId)));
  const inTournament = new Set(tournamentMatchRows.map((r) => r.matchId));

  const existingRows = await db
    .select({ matchId: matchStreams.matchId })
    .from(matchStreams)
    .where(and(inArray(matchStreams.matchId, matchIds), eq(matchStreams.streamChannelId, channelId)));
  const alreadyLinkedIds = new Set(existingRows.map((r) => r.matchId));

  const toInsert = matchIds.filter((id) => inTournament.has(id) && !alreadyLinkedIds.has(id));
  const alreadyLinked = matchIds.filter((id) => inTournament.has(id) && alreadyLinkedIds.has(id)).length;

  if (toInsert.length > 0) {
    await db.insert(matchStreams).values(toInsert.map((matchId) => ({ matchId, streamChannelId: channelId })));
  }

  return { ok: true, linked: toInsert.length, alreadyLinked };
}

export type UnlinkStreamResult = { ok: true } | { ok: false; error: "notFound" };

export async function unlinkStreamChannelFromMatch(organizationId: number, channelId: number, matchId: number): Promise<UnlinkStreamResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.streamsLink);

  const [channel] = await db.select({ organizationId: streamChannels.organizationId }).from(streamChannels).where(eq(streamChannels.id, channelId)).limit(1);
  if (!channel || channel.organizationId !== organizationId) return { ok: false, error: "notFound" };

  await db.delete(matchStreams).where(and(eq(matchStreams.matchId, matchId), eq(matchStreams.streamChannelId, channelId)));
  return { ok: true };
}
