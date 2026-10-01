/**
 * GC-Stats - dashboard-streams-data
 *
 * Query helpers for an organization's stream channels and their linked
 * match streams on the dashboard.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, desc, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { streamChannels, matchStreams, matches, entrants, stageContainers, stages, tournaments } from "@gc-stats/db";
import { normalizeScheduledAt } from "@/lib/match-schedule";

export type OrganizationStreamChannelRow = {
  id: number;
  name: string;
  platform: string;
  type: string;
  url: string;
  languageCode: string;
  isActive: boolean;
};

export async function listOrganizationStreamChannelRows(organizationId: number): Promise<OrganizationStreamChannelRow[]> {
  const rows = await db
    .select({ id: streamChannels.id, name: streamChannels.name, platform: streamChannels.platform, type: streamChannels.type, url: streamChannels.url, languageCode: streamChannels.languageCode, isActive: streamChannels.isActive })
    .from(streamChannels)
    .where(eq(streamChannels.organizationId, organizationId))
    .orderBy(asc(streamChannels.name));
  // `language_code` is a fixed-width `char(5)` column — Postgres right-pads
  // anything shorter (e.g. "fr" -> "fr   ") on every read, which breaks an
  // exact match against news_languages.code ("fr") in the edit <Select> and
  // in isActiveLanguage(). Trim here rather than changing the column type.
  return rows.map((r) => ({ ...r, languageCode: r.languageCode.trim() }));
}

export type OrganizationStreamLink = {
  channelId: number;
  channelName: string;
  matchId: number;
  matchLabel: string;
  tournamentName: string;
  scheduledAt: string | null;
};

/** Every match currently linked to one of this organization's channels — match_streams has no id of its own, its composite key (matchId, channelId) is the identity used to unlink. */
export async function listOrganizationStreamLinks(organizationId: number): Promise<OrganizationStreamLink[]> {
  const channels = await db.select({ id: streamChannels.id, name: streamChannels.name }).from(streamChannels).where(eq(streamChannels.organizationId, organizationId));
  if (channels.length === 0) return [];
  const channelById = new Map(channels.map((c) => [c.id, c.name]));

  const links = await db
    .select({
      channelId: matchStreams.streamChannelId,
      matchId: matchStreams.matchId,
      round: matches.round,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      tournamentName: tournaments.name,
      scheduledAt: matches.scheduledAt,
    })
    .from(matchStreams)
    .innerJoin(matches, eq(matches.id, matchStreams.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(inArray(matchStreams.streamChannelId, channels.map((c) => c.id)))
    .orderBy(desc(matches.id));

  const entrantIds = [...new Set(links.flatMap((l) => [l.entrantAId, l.entrantBId]).filter((id): id is number => id !== null))];
  const entrantRows = entrantIds.length ? await db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, entrantIds)) : [];
  const entrantById = new Map(entrantRows.map((e) => [e.id, e.displayName]));

  return links.map((l) => {
    const aName = l.entrantAId !== null ? (entrantById.get(l.entrantAId) ?? "TBD") : "TBD";
    const bName = l.entrantBId !== null ? (entrantById.get(l.entrantBId) ?? "TBD") : "TBD";
    return {
      channelId: l.channelId,
      channelName: channelById.get(l.channelId) ?? "?",
      matchId: l.matchId,
      matchLabel: `${aName} vs ${bName} (R${l.round})`,
      tournamentName: l.tournamentName,
      scheduledAt: normalizeScheduledAt(l.scheduledAt),
    };
  });
}
