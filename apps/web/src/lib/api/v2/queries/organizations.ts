/**
 * GC-Stats - organizations
 *
 * Query helpers for the API v2 organization endpoints: profile, members,
 * stream channels, vods and press mentions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizations, news } from "@gc-stats/db";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { getOrganizationMembers, getOrganizationStreamChannels, getOrganizationVods, type OrganizationMember, type OrganizationStreamChannel, type OrganizationVod } from "@/lib/organization-page-data";
import { escapeLike } from "../../v1/params";
import { getThemedLogoUrls, type ApiThemedLogoUrls } from "../../v1/logo-response";
import type { ApiPressEntry } from "./teams";

export type ApiOrganizationMemberEntry = {
  membership_id: number;
  person_id: number;
  handle: string;
  country_code: string | null;
  secondary_country_code: string | null;
  role: string;
  since: string | null;
  until: string | null;
};

function toApiOrganizationMember(member: OrganizationMember): ApiOrganizationMemberEntry {
  return {
    membership_id: member.membershipId,
    person_id: member.personId,
    handle: member.handle,
    country_code: member.countryCode,
    secondary_country_code: member.secondaryCountryCode,
    role: member.role,
    since: member.since,
    until: member.until,
  };
}

export type ApiOrganizationMembersResponse = { current: ApiOrganizationMemberEntry[]; formers: ApiOrganizationMemberEntry[] };

export type ApiStreamChannelEntry = { id: number; name: string; platform: string; type: string; url: string; language_code: string };

function toApiStreamChannel(channel: OrganizationStreamChannel): ApiStreamChannelEntry {
  return { id: channel.id, name: channel.name, platform: channel.platform, type: channel.type, url: channel.url, language_code: channel.languageCode };
}

export type ApiOrganizationVodEntry = { id: number; url: string; language_code: string; match_id: number; match_label: string };

function toApiOrganizationVod(vod: OrganizationVod): ApiOrganizationVodEntry {
  return { id: vod.id, url: vod.url, language_code: vod.languageCode, match_id: vod.matchId, match_label: vod.matchLabel };
}

/** No locale filter (unlike the site's `getOrganizationNews`) — same rule as team/player press, every published article is returned with its own `lang`. */
async function getOrganizationPressV2(organizationId: number, organizationName: string, limit = 10): Promise<ApiPressEntry[]> {
  const rows = await db
    .select({ title: news.title, slug: news.slug, publishedAt: news.publishedAt, lang: news.lang })
    .from(news)
    .where(and(eq(news.organizationId, organizationId), isNewsPublishedCondition()))
    .orderBy(desc(news.publishedAt))
    .limit(limit);

  return rows.map((r) => ({ title: r.title, slug: r.slug, publisher: organizationName, published_at: r.publishedAt ? r.publishedAt.toISOString() : null, lang: r.lang }));
}

export type ApiOrganizationFullResponseV2 = {
  id: number;
  name: string;
  slug: string;
  tags: string[];
  country_code: string | null;
  secondary_country_code: string | null;
  socials: Record<string, string>;
  logos: ApiThemedLogoUrls;
  members: ApiOrganizationMembersResponse;
  stream_channels: ApiStreamChannelEntry[];
  vods: ApiOrganizationVodEntry[];
  press: ApiPressEntry[];
};

async function buildOrganizationFullResponse(row: typeof organizations.$inferSelect): Promise<ApiOrganizationFullResponseV2> {
  const [logos, members, streamChannels, vods, press] = await Promise.all([
    getThemedLogoUrls("organization", row.id),
    getOrganizationMembers(row.id),
    getOrganizationStreamChannels(row.id, 50),
    getOrganizationVods(row.id, 10),
    getOrganizationPressV2(row.id, row.name),
  ]);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    country_code: row.countryCode,
    secondary_country_code: row.secondaryCountryCode,
    socials: (row.socials as Record<string, string>) ?? {},
    logos,
    members: { current: members.current.map(toApiOrganizationMember), formers: members.formers.map(toApiOrganizationMember) },
    stream_channels: streamChannels.map(toApiStreamChannel),
    vods: vods.map(toApiOrganizationVod),
    press,
  };
}

export async function getOrganizationByIdV2(id: number): Promise<ApiOrganizationFullResponseV2 | null> {
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!row) return null;
  return buildOrganizationFullResponse(row);
}

export async function searchOrganizationsByNameV2(query: string): Promise<ApiOrganizationFullResponseV2[]> {
  const pattern = `${escapeLike(query)}%`;
  const rows = await db.select().from(organizations).where(ilike(organizations.name, pattern)).orderBy(organizations.name).limit(10);

  return Promise.all(rows.map(buildOrganizationFullResponse));
}
