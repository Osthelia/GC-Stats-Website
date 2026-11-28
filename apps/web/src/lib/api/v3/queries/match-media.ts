/**
 * GC-Stats - match-media
 *
 * Streams, player POV streams and VODs of a match, shaped for the API v3
 * match response.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { gameTables, organizations, seriesMapTableOf } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";
import { visiblePerson } from "@/lib/ghost-visibility";
import { resolveEntrantTeamIds } from "../../v1/entrant-teams";

export type ApiMatchStream = {
  id: number;
  name: string;
  platform: string;
  type: string;
  url: string;
  language_code: string;
  organization_id: number | null;
};

export type ApiMatchPlayerPov = {
  id: number;
  team_id: number | null;
  player_id: number | null;
  player_handle: string | null;
  twitch_login: string;
  title: string | null;
  url: string;
  last_seen_live_at: string | null;
};

export type ApiMatchVod = {
  id: number;
  url: string;
  language_code: string;
  map_id: number | null;
  map_order: number | null;
  organization: { id: number; name: string } | null;
};

export type ApiMatchMedia = {
  streams: ApiMatchStream[];
  player_povs: ApiMatchPlayerPov[];
  vods: ApiMatchVod[];
};

async function getStreams(game: GameSlug, matchId: number): Promise<ApiMatchStream[]> {
  const { matchStreams, streamChannels } = gameTables(game);
  const rows = await db
    .select({
      id: streamChannels.id,
      name: streamChannels.name,
      platform: streamChannels.platform,
      type: streamChannels.type,
      url: streamChannels.url,
      languageCode: streamChannels.languageCode,
      organizationId: streamChannels.organizationId,
    })
    .from(matchStreams)
    .innerJoin(streamChannels, eq(streamChannels.id, matchStreams.streamChannelId))
    .where(and(eq(matchStreams.matchId, matchId), eq(streamChannels.isActive, true)))
    .orderBy(asc(streamChannels.id));

  // Official streams first, watchparties after.
  return rows
    .sort((a, b) => Number(a.type === "watchparty") - Number(b.type === "watchparty"))
    .map((r) => ({
      id: r.id,
      name: r.name,
      platform: r.platform,
      type: r.type,
      url: r.url,
      language_code: r.languageCode,
      organization_id: r.organizationId,
    }));
}

async function getPlayerPovs(game: GameSlug, matchId: number): Promise<ApiMatchPlayerPov[]> {
  const { matchPlayerPovs, people } = gameTables(game);
  const rows = await db
    .select({
      id: matchPlayerPovs.id,
      entrantId: matchPlayerPovs.entrantId,
      personId: matchPlayerPovs.personId,
      handle: people.handle,
      twitchLogin: matchPlayerPovs.twitchLogin,
      title: matchPlayerPovs.title,
      url: matchPlayerPovs.url,
      lastSeenLiveAt: matchPlayerPovs.lastSeenLiveAt,
    })
    .from(matchPlayerPovs)
    .leftJoin(people, eq(people.id, matchPlayerPovs.personId))
    .where(and(eq(matchPlayerPovs.matchId, matchId), or(isNull(matchPlayerPovs.personId), visiblePerson(game))))
    .orderBy(asc(matchPlayerPovs.id));

  const teamByEntrant = await resolveEntrantTeamIds(game, [...new Set(rows.map((r) => r.entrantId))]);

  return rows.map((r) => ({
    id: r.id,
    team_id: teamByEntrant.get(r.entrantId) ?? null,
    player_id: r.personId,
    player_handle: r.handle,
    twitch_login: r.twitchLogin,
    title: r.title,
    url: r.url,
    last_seen_live_at: r.lastSeenLiveAt ? r.lastSeenLiveAt.toISOString() : null,
  }));
}

async function getVods(game: GameSlug, matchId: number): Promise<ApiMatchVod[]> {
  const { vods } = gameTables(game);
  const maps = seriesMapTableOf(game);
  const rows = await db
    .select({ id: vods.id, url: vods.url, languageCode: vods.languageCode, mapId: vods.mapId, organizationId: vods.organizationId })
    .from(vods)
    .where(eq(vods.matchId, matchId))
    .orderBy(asc(vods.id));
  if (rows.length === 0) return [];

  const mapIds = [...new Set(rows.map((r) => r.mapId).filter((id): id is number => id != null))];
  const organizationIds = [...new Set(rows.map((r) => r.organizationId).filter((id): id is number => id != null))];

  const [mapRows, organizationRows] = await Promise.all([
    mapIds.length ? db.select({ id: maps.id, order: maps.order }).from(maps).where(inArray(maps.id, mapIds)) : [],
    organizationIds.length ? db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, organizationIds)) : [],
  ]);
  const orderByMapId = new Map(mapRows.map((m) => [m.id, m.order]));
  const organizationById = new Map(organizationRows.map((o) => [o.id, o]));

  return rows.map((r) => {
    const organization = r.organizationId != null ? organizationById.get(r.organizationId) : undefined;
    return {
      id: r.id,
      url: r.url,
      language_code: r.languageCode,
      map_id: r.mapId,
      map_order: r.mapId != null ? (orderByMapId.get(r.mapId) ?? null) : null,
      organization: organization ? { id: organization.id, name: organization.name } : null,
    };
  });
}

export async function getMatchMedia(game: GameSlug, matchId: number): Promise<ApiMatchMedia> {
  const [streams, playerPovs, matchVods] = await Promise.all([getStreams(game, matchId), getPlayerPovs(game, matchId), getVods(game, matchId)]);
  return { streams, player_povs: playerPovs, vods: matchVods };
}
