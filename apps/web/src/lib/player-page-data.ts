/**
 * GC-Stats - player-page-data
 *
 * Data fetching for the public player profile page: bio/info, team and
 * organization history, matches (derived from real per-map stats), stage
 * achievements, stats filter options, and related press.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { and, desc, eq, gte, inArray, isNotNull, lte, sql, type SQLWrapper } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { visiblePerson } from "@/lib/ghost-visibility";
import {
  people,
  teams,
  rosterMemberships,
  entrants,
  matches,
  tournaments,
  stages,
  stageContainers,
  qualificationResults,
  stageQualifications,
  news,
  organizations,
  newsRelations,
  maps,
  mapPlayerStats,
  organizationMemberships,
  productionCredits,
} from "@gc-stats/db";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";
import { getEntityLogos, themedLogoUrls, getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { getEntityMatches } from "@/lib/entity-matches";
import type { HomeMatch } from "@/lib/home-data";
import { resolveNewsLanguages } from "@/lib/news-languages";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import type { AppLocale } from "@/i18n/routing";
import type { ParsedStatsFilters } from "@/lib/stats-filters";
import { resolveDateBounds } from "@/lib/stats-filters";

export type PlayerPageInfo = {
  id: number;
  handle: string;
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  pronouns: number | null;
  bio: string | null;
  socials: Record<string, string>;
  liquipediaLink: string | null;
  isActive: boolean;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

/** Deduplicated per request: the tabs layout and the page both read it. */
export const getPlayerPageInfo = cache(async (id: number): Promise<PlayerPageInfo | null> => {
  const [[row], logoEntries] = await Promise.all([
    db
      .select({
        id: people.id,
        handle: people.handle,
        firstName: people.firstName,
        lastName: people.lastName,
        countryCode: people.countryCode,
        secondaryCountryCode: people.secondaryCountryCode,
        pronouns: people.pronouns,
        bio: people.bio,
        socials: people.socials,
        liquipediaLink: people.liquipediaLink,
        isActive: people.isActive,
      })
      .from(people)
      .where(and(eq(people.id, id), visiblePerson))
      .limit(1),
    getEntityLogos("person", id),
  ]);
  if (!row) return null;
  const themed = themedLogoUrls(logoEntries, "person");

  return {
    id: row.id,
    handle: row.handle,
    firstName: row.firstName,
    lastName: row.lastName,
    countryCode: row.countryCode,
    secondaryCountryCode: row.secondaryCountryCode,
    pronouns: row.pronouns,
    bio: row.bio,
    socials: (row.socials as Record<string, string>) ?? {},
    liquipediaLink: row.liquipediaLink,
    isActive: row.isActive,
    logoUrl: themed.dark,
    logoUrlLight: themed.light,
  };
});

export type PlayerTabAvailability = {
  /** Backs both the Matches and Stats tabs — same underlying signal (`map_player_stats`), a person with one has the other. */
  hasMatches: boolean;
  hasTeamHistory: boolean;
  hasProduction: boolean;
};

/** `PlayerHeader` only shows a tab when it has something to show: existence checks in one round trip. */
export async function getPlayerTabAvailability(personId: number): Promise<PlayerTabAvailability> {
  const exists = (sub: SQLWrapper) => sql<boolean>`exists(${sub})`.mapWith(Boolean);
  const [row] = await db
    .select({
      hasMatches: exists(db.select({ one: sql`1` }).from(mapPlayerStats).where(eq(mapPlayerStats.personId, personId))),
      hasTeamHistory: exists(db.select({ one: sql`1` }).from(rosterMemberships).where(eq(rosterMemberships.personId, personId))),
      hasOrganization: exists(db.select({ one: sql`1` }).from(organizationMemberships).where(eq(organizationMemberships.personId, personId))),
      hasCredit: exists(db.select({ one: sql`1` }).from(productionCredits).where(eq(productionCredits.personId, personId))),
    })
    .from(people)
    .where(eq(people.id, personId));
  if (!row) return { hasMatches: false, hasTeamHistory: false, hasProduction: false };

  return {
    hasMatches: row.hasMatches,
    hasTeamHistory: row.hasTeamHistory,
    hasProduction: row.hasOrganization || row.hasCredit,
  };
}

export type PlayerTeamHistoryEntry = {
  membershipId: number;
  teamId: number;
  teamName: string;
  teamShortName: string | null;
  teamCountryCode: string | null;
  teamSecondaryCountryCode: string | null;
  role: string;
  since: string | null;
  until: string | null;
  inactiveSince: string | null;
  teamLogoUrl: string | null;
  teamLogoUrlLight: string | null;
};

/** Deduplicated per request: the overview reads it from two Suspense boundaries. */
export const getPlayerTeamHistory = cache(async (personId: number): Promise<{ current: PlayerTeamHistoryEntry[]; formers: PlayerTeamHistoryEntry[] }> => {
  const rows = await db
    .select({
      membershipId: rosterMemberships.id,
      teamId: teams.id,
      teamName: teams.name,
      teamShortName: teams.shortName,
      teamCountryCode: teams.countryCode,
      teamSecondaryCountryCode: teams.secondaryCountryCode,
      role: rosterMemberships.role,
      period: rosterMemberships.period,
      inactiveSince: rosterMemberships.inactiveSince,
    })
    .from(rosterMemberships)
    .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .where(eq(rosterMemberships.personId, personId))
    .orderBy(desc(rosterMemberships.id));

  const logosByTeamId = await getCurrentLogoUrlsThemed("team", [...new Set(rows.map((r) => r.teamId))]);

  const currentByTeamId = new Map<number, PlayerTeamHistoryEntry>();
  const formers: PlayerTeamHistoryEntry[] = [];

  for (const r of rows) {
    const entry: PlayerTeamHistoryEntry = {
      membershipId: r.membershipId,
      teamId: r.teamId,
      teamName: r.teamName,
      teamShortName: r.teamShortName,
      teamCountryCode: r.teamCountryCode,
      teamSecondaryCountryCode: r.teamSecondaryCountryCode,
      role: r.role,
      since: rangeLower(r.period),
      until: rangeUpper(r.period),
      inactiveSince: r.inactiveSince,
      teamLogoUrl: logosByTeamId.get(r.teamId)?.dark ?? null,
      teamLogoUrlLight: logosByTeamId.get(r.teamId)?.light ?? null,
    };
    if (!rangeIsOpen(r.period)) {
      formers.push(entry);
      continue;
    }
    // A person can have several open roster_memberships rows for the same
    // team (unclosed migration data) — keep the one with a known "since",
    // or the most recent (rows come ordered by id desc) otherwise.
    const existing = currentByTeamId.get(r.teamId);
    if (existing && (existing.since !== null || entry.since === null)) continue;
    currentByTeamId.set(r.teamId, entry);
  }

  const current = [...currentByTeamId.values()];
  formers.sort((a, b) => (b.until ?? "").localeCompare(a.until ?? ""));

  return { current, formers };
});

/** Handle only, for the `/player/{id}` redirect to the canonical URL. */
export async function getPlayerHandle(id: number): Promise<string | null> {
  const [row] = await db.select({ handle: people.handle }).from(people).where(and(eq(people.id, id), visiblePerson)).limit(1);
  return row?.handle ?? null;
}

/** Overview tab: only played/in-progress matches, capped short. */
export async function getPlayerRecentMatches(personId: number, limit = 10): Promise<HomeMatch[]> {
  return getEntityMatches({ kind: "player", id: personId }, { statuses: ["completed", "live"], limit });
}

export type PlayerAchievement = {
  qualificationId: number;
  tournamentId: number;
  tournamentName: string;
  category: string | null;
  teamName: string;
  placement: number;
  placementLabel: string | null;
  endDate: string;
};

/**
 * A placement counts for this person when they were on the winning team's
 * roster while the tournament was ongoing (`roster_memberships.period`
 * contains the tournament's end date) — entrant-level attribution isn't
 * possible here, see `getPlayerMatches` for why.
 */
export async function getPlayerAchievements(personId: number): Promise<{ items: PlayerAchievement[]; titles: number; podiums: number }> {
  const rows = await db
    .select({
      qualificationId: stageQualifications.id,
      placement: stageQualifications.placement,
      placementLabel: stageQualifications.placementLabel,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      category: tournaments.category,
      teamName: teams.name,
      endDate: tournaments.endDate,
    })
    .from(qualificationResults)
    .innerJoin(stageQualifications, eq(stageQualifications.id, qualificationResults.qualificationId))
    .innerJoin(entrants, eq(entrants.id, qualificationResults.entrantId))
    .innerJoin(teams, eq(teams.id, entrants.teamId))
    .innerJoin(rosterMemberships, eq(rosterMemberships.teamId, entrants.teamId))
    .leftJoin(matches, eq(matches.id, stageQualifications.sourceMatchId))
    .innerJoin(stageContainers, eq(stageContainers.id, sql`coalesce(${stageQualifications.sourceContainerId}, ${matches.containerId})`))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(
      and(
        eq(rosterMemberships.personId, personId),
        eq(stageQualifications.destinationType, "placement"),
        isNotNull(stageQualifications.placement),
        lte(stageQualifications.placement, 3),
        sql`${rosterMemberships.period} @> ${tournaments.endDate}`,
      ),
    )
    .orderBy(desc(tournaments.endDate));

  // Same qualification can be reached via more than one roster row if the
  // person had overlapping memberships (e.g. player then briefly also coach)
  // — dedupe by qualification id.
  const seen = new Set<number>();
  const items = rows.filter((r): r is typeof r & { placement: number } => r.placement != null && (seen.has(r.qualificationId) ? false : (seen.add(r.qualificationId), true)));

  return {
    items,
    titles: items.filter((r) => r.placement === 1).length,
    podiums: items.length,
  };
}

/** Distinct agents/maps this person has stats for — feeds the stats page filter dropdowns (always shows every option, independent of the currently applied filters). */
export async function getPlayerStatsFilterOptions(personId: number): Promise<{ agents: string[]; maps: string[] }> {
  const [agentRows, mapRows] = await Promise.all([
    db.selectDistinct({ agentName: mapPlayerStats.agentName }).from(mapPlayerStats).where(eq(mapPlayerStats.personId, personId)),
    db
      .selectDistinct({ mapName: maps.mapName })
      .from(mapPlayerStats)
      .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
      .where(eq(mapPlayerStats.personId, personId)),
  ]);

  return {
    agents: agentRows.map((r) => r.agentName).filter((a): a is string => !!a).sort(),
    maps: mapRows.map((r) => r.mapName).filter((m): m is string => !!m).sort(),
  };
}

/** Rows of the player stats page, as a subquery for `aggregateMapPlayerStatsSql`. */
export function playerStatsScope(personId: number, filters: ParsedStatsFilters): SQLWrapper {
  const { from, to } = resolveDateBounds(filters);

  const conditions = [eq(mapPlayerStats.personId, personId)];
  if (filters.agent) conditions.push(eq(mapPlayerStats.agentName, filters.agent));
  if (filters.map) conditions.push(eq(maps.mapName, filters.map));
  if (from) conditions.push(gte(maps.startedAt, from));
  if (to) conditions.push(lte(maps.startedAt, to));

  return db
    .select({ id: mapPlayerStats.id })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .where(and(...conditions));
}

export type PlayerPressItem = {
  title: string;
  slug: string;
  publisher: string;
  publishedAt: Date | null;
  lang: string;
};

/** Not customizable here (only the /news listing page exposes the language filter) — always the site-locale + English default rule. */
export async function getPlayerPress(personId: number, locale: AppLocale, limit = 5): Promise<PlayerPressItem[]> {
  const languages = await resolveNewsLanguages(locale);
  const rows = await db
    .select({
      title: news.title,
      slug: news.slug,
      publisher: organizations.name,
      publishedAt: news.publishedAt,
      lang: news.lang,
    })
    .from(newsRelations)
    .innerJoin(news, eq(news.id, newsRelations.newsId))
    .leftJoin(organizations, eq(organizations.id, news.organizationId))
    .where(and(eq(newsRelations.relatableType, "person"), eq(newsRelations.relatableId, personId), isNewsPublishedCondition(), inArray(news.lang, languages)))
    .orderBy(desc(news.publishedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, publisher: r.publisher ?? "GC-Stats" }));
}
