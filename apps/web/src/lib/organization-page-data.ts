/**
 * GC-Stats - organization-page-data
 *
 * Public /organization page data: profile info, current/former members
 * ordered by role, stream channels, VODs, and paginated news.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import {
  organizations,
  organizationMemberships,
  people,
  news,
  streamChannels,
  vods,
  matches,
  entrants,
  teams,
  tournaments,
} from "@gc-stats/db";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";
import { getEntityLogos, themedLogoUrls, getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { visibleTournament } from "@/lib/ghost-visibility";
import { REGIONS, normalizeRegion } from "@/lib/tournament-regions";
import { slugify } from "@/lib/entity-id";
import { abbreviateTournamentName } from "@/lib/home-data";
import type { TournamentListCardItem } from "@/components/tournament/tournament-list-card";
import { resolveNewsLanguages } from "@/lib/news-languages";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import type { PublicNewsListItem } from "@/lib/news-page-data";
import type { AppLocale } from "@/i18n/routing";

export type OrganizationPageInfo = {
  id: number;
  name: string;
  slug: string;
  tags: string[];
  countryCode: string | null;
  secondaryCountryCode: string | null;
  bio: string | null;
  socials: Record<string, string>;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

export const getOrganizationPageInfo = cache(async (id: number): Promise<OrganizationPageInfo | null> => {
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!row) return null;

  const logoEntries = await getEntityLogos("organization", id);
  const themed = themedLogoUrls(logoEntries, "organization");

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    countryCode: row.countryCode,
    secondaryCountryCode: row.secondaryCountryCode,
    bio: row.bio,
    socials: (row.socials as Record<string, string>) ?? {},
    logoUrl: themed.dark,
    logoUrlLight: themed.light,
  };
});

export type OrganizationMember = {
  membershipId: number;
  personId: number;
  handle: string;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  pronouns: number | null;
  role: string;
  since: string | null;
  until: string | null;
};

// Canonical order for `organization-roles.ts::ORGANIZATION_MEMBER_ROLES` —
// unrecognized/legacy free-text role values sort last rather than crashing.
const ROLE_ORDER = [
  "owner",
  "president",
  "coPresident",
  "vicePresident",
  "ceo",
  "coCeo",
  "generalDirector",
  "admin",
  "secretary",
  "treasurer",
  "tournamentAdmin",
  "communityManager",
  "moderator",
  "editor",
  "journalist",
  "caster",
  "observer",
  "producer",
  "manager",
  "partnershipsManager",
  "communicationsManager",
  "recruitmentManager",
  "developer",
  "volunteer",
];

export async function getOrganizationMembers(organizationId: number): Promise<{ current: OrganizationMember[]; formers: OrganizationMember[] }> {
  const rows = await db
    .select({
      membershipId: organizationMemberships.id,
      personId: people.id,
      handle: people.handle,
      countryCode: people.countryCode,
      secondaryCountryCode: people.secondaryCountryCode,
      pronouns: people.pronouns,
      role: organizationMemberships.role,
      period: organizationMemberships.period,
    })
    .from(organizationMemberships)
    .innerJoin(people, eq(people.id, organizationMemberships.personId))
    .where(eq(organizationMemberships.organizationId, organizationId))
    .orderBy(desc(organizationMemberships.id));

  const current: OrganizationMember[] = [];
  const formers: OrganizationMember[] = [];

  for (const r of rows) {
    const member = {
      membershipId: r.membershipId,
      personId: r.personId,
      handle: r.handle,
      countryCode: r.countryCode,
      secondaryCountryCode: r.secondaryCountryCode,
      pronouns: r.pronouns,
      role: r.role,
      since: rangeLower(r.period),
      until: rangeUpper(r.period),
    };
    if (rangeIsOpen(r.period)) current.push(member);
    else formers.push(member);
  }

  current.sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.role);
    const bi = ROLE_ORDER.indexOf(b.role);
    return (ai === -1 ? ROLE_ORDER.length : ai) - (bi === -1 ? ROLE_ORDER.length : bi);
  });
  formers.sort((a, b) => (b.until ?? "").localeCompare(a.until ?? ""));

  return { current, formers };
}

export type OrganizationStreamChannel = {
  id: number;
  name: string;
  platform: string;
  type: string;
  url: string;
  languageCode: string;
};

export async function getOrganizationStreamChannels(organizationId: number, limit = 5): Promise<OrganizationStreamChannel[]> {
  return db
    .select({ id: streamChannels.id, name: streamChannels.name, platform: streamChannels.platform, type: streamChannels.type, url: streamChannels.url, languageCode: streamChannels.languageCode })
    .from(streamChannels)
    .where(and(eq(streamChannels.organizationId, organizationId), eq(streamChannels.isActive, true)))
    .orderBy(desc(streamChannels.id))
    .limit(limit);
}

export type OrganizationVod = {
  id: number;
  url: string;
  languageCode: string;
  matchId: number;
  matchLabel: string;
};

export async function getOrganizationVods(organizationId: number, limit = 5): Promise<OrganizationVod[]> {
  const rows = await db
    .select({
      id: vods.id,
      url: vods.url,
      languageCode: vods.languageCode,
      matchId: vods.matchId,
      scheduledAt: matches.scheduledAt,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
    })
    .from(vods)
    .innerJoin(matches, eq(matches.id, vods.matchId))
    .where(eq(vods.organizationId, organizationId))
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const entrantIds = rows.flatMap((r) => [r.entrantAId, r.entrantBId]).filter((id): id is number => id != null);
  const entrantRows = entrantIds.length
    ? await db.select({ id: entrants.id, displayName: entrants.displayName, teamId: entrants.teamId }).from(entrants).where(inArray(entrants.id, entrantIds))
    : [];
  const teamIds = entrantRows.map((e) => e.teamId).filter((id): id is number => id != null);
  const teamNames = teamIds.length ? await db.select({ id: teams.id, shortName: teams.shortName }).from(teams).where(inArray(teams.id, teamIds)) : [];
  const shortNameById = new Map(teamNames.map((t) => [t.id, t.shortName]));
  const nameByEntrantId = new Map(entrantRows.map((e) => [e.id, e.teamId ? (shortNameById.get(e.teamId) ?? e.displayName) : e.displayName]));

  return rows.map((r) => {
    const a = r.entrantAId != null ? (nameByEntrantId.get(r.entrantAId) ?? "?") : "?";
    const b = r.entrantBId != null ? (nameByEntrantId.get(r.entrantBId) ?? "?") : "?";
    return { id: r.id, url: r.url, languageCode: r.languageCode, matchId: r.matchId, matchLabel: `${a} vs ${b}` };
  });
}

export type OrganizationNewsItem = {
  title: string;
  slug: string;
  publisher: string;
  publishedAt: Date | null;
  lang: string;
};

/** Same viewer language preference as `/news` (cookie-backed, see `resolveNewsLanguages`) — not just the site-locale + English default. */
export async function getOrganizationNews(organizationId: number, organizationName: string, locale: AppLocale, limit = 5): Promise<OrganizationNewsItem[]> {
  const languages = await resolveNewsLanguages(locale);
  const rows = await db
    .select({ title: news.title, slug: news.slug, publishedAt: news.publishedAt, lang: news.lang })
    .from(news)
    .where(and(eq(news.organizationId, organizationId), isNewsPublishedCondition(), inArray(news.lang, languages)))
    .orderBy(desc(news.publishedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, publisher: organizationName }));
}

const ORG_NEWS_PAGE_SIZE = 12;
const ORG_NEWS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Paginated, filterable version of `getOrganizationNews` for the organization's own dedicated news tab (`/organization/{id}/{slug}/news`). */
export async function getOrganizationNewsPage(
  organizationId: number,
  organization: { name: string; logoUrl: string | null; logoUrlLight: string | null },
  opts: { languages: string[]; dateFrom: string; dateTo: string; page: number }
): Promise<{ items: PublicNewsListItem[]; total: number; perPage: number }> {
  const conditions = [eq(news.organizationId, organizationId), isNewsPublishedCondition(), inArray(news.lang, opts.languages)];
  // `dateTo` is inclusive of the whole day, hence `< dateTo + 1 day` rather than `<= dateTo` (publishedAt carries a time-of-day component).
  if (opts.dateFrom && ORG_NEWS_DATE_RE.test(opts.dateFrom)) conditions.push(gte(news.publishedAt, new Date(`${opts.dateFrom}T00:00:00.000Z`)));
  if (opts.dateTo && ORG_NEWS_DATE_RE.test(opts.dateTo)) {
    const upperBound = new Date(`${opts.dateTo}T00:00:00.000Z`);
    upperBound.setUTCDate(upperBound.getUTCDate() + 1);
    conditions.push(lt(news.publishedAt, upperBound));
  }
  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({ id: news.id, title: news.title, slug: news.slug, excerpt: news.excerpt, imageCover: news.imageCover, lang: news.lang, publishedAt: news.publishedAt, isFeatured: news.isFeatured })
      .from(news)
      .where(where)
      .orderBy(desc(news.publishedAt))
      .limit(ORG_NEWS_PAGE_SIZE)
      .offset((opts.page - 1) * ORG_NEWS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(news).where(where),
  ]);
  const total = countRows[0]?.count ?? 0;

  const items = rows.map((r) => ({
    ...r,
    publisherName: organization.name,
    publisherLogoUrl: organization.logoUrl,
    publisherLogoUrlLight: organization.logoUrlLight,
  }));

  return { items, total, perPage: ORG_NEWS_PAGE_SIZE };
}

const TOURNAMENT_DATE_LOCALES: Record<AppLocale, string> = { fr: "fr-FR", en: "en-US", es: "es-ES", pt: "pt-BR", tr: "tr-TR", ja: "ja-JP", ko: "ko-KR", de: "de-DE", zh: "zh-CN", it: "it-IT", pl: "pl-PL", ar: "ar", th: "th-TH" };

/** Public tournaments organized by the organization: live first, then most recent. */
export async function getOrganizationTournaments(organizationId: number, locale: AppLocale): Promise<TournamentListCardItem[]> {
  const rows = await db
    .select({ id: tournaments.id, name: tournaments.name, region: tournaments.region, startDate: tournaments.startDate, endDate: tournaments.endDate })
    .from(tournaments)
    .where(and(eq(tournaments.organizerOrganizationId, organizationId), eq(tournaments.active, true), visibleTournament))
    .orderBy(sql`(${tournaments.status} = 'live') desc`, desc(tournaments.startDate), desc(tournaments.id));
  if (rows.length === 0) return [];

  const logos = await getCurrentLogoUrlsThemed("tournament", rows.map((r) => r.id));
  const format = new Intl.DateTimeFormat(TOURNAMENT_DATE_LOCALES[locale], { day: "numeric", month: "short", year: "numeric" });
  const fmt = (d: string) => format.format(new Date(`${d.slice(0, 10)}T00:00:00`));

  return rows.map((r) => {
    const region = REGIONS[normalizeRegion(r.region)];
    return {
      id: r.id,
      slug: slugify(r.name),
      name: abbreviateTournamentName(r.name),
      region: region.label,
      regionColor: region.color,
      dates: `${fmt(r.startDate)} - ${fmt(r.endDate)}`,
      logoUrl: logos.get(r.id)?.dark ?? null,
      logoUrlLight: logos.get(r.id)?.light ?? null,
    };
  });
}
