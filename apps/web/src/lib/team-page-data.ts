/**
 * GC-Stats - team-page-data
 *
 * Data fetching for the public team profile page: bio/info, current and
 * former roster, name history, matches (team always on side "a"), stage
 * achievements, and related press.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { and, desc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { visibleTeam } from "@/lib/ghost-visibility";
import {
  teams,
  teamNameHistory,
  rosterMemberships,
  people,
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
} from "@gc-stats/db";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";
import { getEntityLogos, themedLogoUrls, getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { getEntityMatches } from "@/lib/entity-matches";
import type { HomeMatch } from "@/lib/home-data";
import { resolveNewsLanguages } from "@/lib/news-languages";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import type { AppLocale } from "@/i18n/routing";

export type TeamPageInfo = {
  id: number;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  isActive: boolean;
  bio: string | null;
  socials: Record<string, string>;
  liquipediaLink: string | null;
  tags: string[];
  logoUrl: string | null;
  logoUrlLight: string | null;
};

/** Deduplicated per request: the tabs layout and the page both read it. */
export const getTeamPageInfo = cache(async (id: number): Promise<TeamPageInfo | null> => {
  const [[row], logoEntries] = await Promise.all([
    db
      .select({
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        countryCode: teams.countryCode,
        secondaryCountryCode: teams.secondaryCountryCode,
        isActive: teams.isActive,
        bio: teams.bio,
        socials: teams.socials,
        liquipediaLink: teams.liquipediaLink,
        tags: teams.tags,
      })
      .from(teams)
      .where(and(eq(teams.id, id), visibleTeam))
      .limit(1),
    getEntityLogos("team", id),
  ]);
  if (!row) return null;
  const themed = themedLogoUrls(logoEntries, "team");

  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    countryCode: row.countryCode,
    secondaryCountryCode: row.secondaryCountryCode,
    isActive: row.isActive,
    bio: row.bio,
    socials: (row.socials as Record<string, string>) ?? {},
    liquipediaLink: row.liquipediaLink,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    logoUrl: themed.dark,
    logoUrlLight: themed.light,
  };
});

const STAFF_ROLES = new Set(["coach", "assistant coach", "performance coach", "analyst", "manager"]);

export type TeamRosterMember = {
  membershipId: number;
  personId: number;
  handle: string;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  role: string;
  since: string | null;
  isStaff: boolean;
  inactiveSince: string | null;
  photoUrl: string | null;
  photoUrlLight: string | null;
  pronouns: number | null;
};

export type TeamFormerMember = {
  membershipId: number;
  personId: number;
  handle: string;
  role: string;
  since: string | null;
  until: string | null;
  inactiveSince: string | null;
  photoUrl: string | null;
  photoUrlLight: string | null;
  pronouns: number | null;
};

export type TeamRosterOptions = {
  /** Formers slice to return, all of them otherwise. */
  formers?: { offset: number; limit: number };
  /** Skip the photo lookup (suggest-edit only reads names and dates). */
  photos?: boolean;
};

export async function getTeamRoster(
  teamId: number,
  { formers: formersSlice, photos = true }: TeamRosterOptions = {},
): Promise<{ current: TeamRosterMember[]; formers: TeamFormerMember[]; formersTotal: number }> {
  const rows = await db
    .select({
      membershipId: rosterMemberships.id,
      personId: people.id,
      handle: people.handle,
      countryCode: people.countryCode,
      secondaryCountryCode: people.secondaryCountryCode,
      role: rosterMemberships.role,
      period: rosterMemberships.period,
      inactiveSince: rosterMemberships.inactiveSince,
      pronouns: people.pronouns,
    })
    .from(rosterMemberships)
    .innerJoin(people, eq(people.id, rosterMemberships.personId))
    .where(eq(rosterMemberships.teamId, teamId))
    .orderBy(desc(rosterMemberships.id));

  const currentByPersonId = new Map<number, TeamRosterMember>();
  const allFormers: TeamFormerMember[] = [];

  for (const r of rows) {
    if (rangeIsOpen(r.period)) {
      // A person can have several open roster_memberships rows (unclosed
      // migration data) — keep the one with a known "since", or the most
      // recent (rows come ordered by id desc) otherwise.
      const existing = currentByPersonId.get(r.personId);
      if (existing && (existing.since !== null || rangeLower(r.period) === null)) continue;
      currentByPersonId.set(r.personId, {
        membershipId: r.membershipId,
        personId: r.personId,
        handle: r.handle,
        countryCode: r.countryCode,
        secondaryCountryCode: r.secondaryCountryCode,
        role: r.role,
        since: rangeLower(r.period),
        isStaff: STAFF_ROLES.has(r.role),
        inactiveSince: r.inactiveSince,
        photoUrl: null,
        photoUrlLight: null,
        pronouns: r.pronouns,
      });
    } else {
      allFormers.push({
        membershipId: r.membershipId,
        personId: r.personId,
        handle: r.handle,
        role: r.role,
        since: rangeLower(r.period),
        until: rangeUpper(r.period),
        inactiveSince: r.inactiveSince,
        photoUrl: null,
        photoUrlLight: null,
        pronouns: r.pronouns,
      });
    }
  }

  // Players first, then staff — same grouping as the V1 team page.
  const current = [...currentByPersonId.values()].sort((a, b) => Number(a.isStaff) - Number(b.isStaff));
  allFormers.sort((a, b) => (b.until ?? "").localeCompare(a.until ?? ""));
  const formers = formersSlice ? allFormers.slice(formersSlice.offset, formersSlice.offset + formersSlice.limit) : allFormers;

  // Photos only for the members actually rendered.
  if (photos) {
    const shown = [...current, ...formers];
    const photosByPersonId = await getCurrentLogoUrlsThemed("person", [...new Set(shown.map((m) => m.personId))]);
    for (const m of shown) {
      const photo = photosByPersonId.get(m.personId);
      m.photoUrl = photo?.dark ?? null;
      m.photoUrlLight = photo?.light ?? null;
    }
  }

  return { current, formers, formersTotal: allFormers.length };
}

export type TeamNameHistoryEntry = {
  id: number;
  name: string;
  since: string | null;
  until: string | null;
  isVisible: boolean;
};

export async function getTeamNameHistory(teamId: number): Promise<TeamNameHistoryEntry[]> {
  const rows = await db
    .select({ id: teamNameHistory.id, name: teamNameHistory.name, period: teamNameHistory.period, isVisible: teamNameHistory.isVisible })
    .from(teamNameHistory)
    .where(eq(teamNameHistory.teamId, teamId))
    .orderBy(desc(teamNameHistory.id));

  return rows.map((r) => ({ id: r.id, name: r.name, since: rangeLower(r.period), until: rangeUpper(r.period), isVisible: r.isVisible }));
}

/** Overview tab: only played/in-progress matches, capped short. */
export async function getTeamRecentMatches(teamId: number, limit = 10): Promise<HomeMatch[]> {
  return getEntityMatches({ kind: "team", id: teamId }, { statuses: ["completed", "live"], limit });
}

export async function getTeamUpcomingMatches(teamId: number, limit = 2): Promise<HomeMatch[]> {
  return getEntityMatches({ kind: "team", id: teamId }, { statuses: ["pending"], scheduledFrom: new Date(), limit });
}

export type TeamAchievement = {
  qualificationId: number;
  tournamentId: number;
  tournamentName: string;
  placement: number;
  placementLabel: string | null;
  endDate: string;
};

export async function getTeamAchievements(teamId: number): Promise<{ items: TeamAchievement[]; titles: number; podiums: number }> {
  const rows = await db
    .select({
      qualificationId: stageQualifications.id,
      placement: stageQualifications.placement,
      placementLabel: stageQualifications.placementLabel,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      endDate: tournaments.endDate,
    })
    .from(qualificationResults)
    .innerJoin(stageQualifications, eq(stageQualifications.id, qualificationResults.qualificationId))
    .innerJoin(entrants, eq(entrants.id, qualificationResults.entrantId))
    .leftJoin(matches, eq(matches.id, stageQualifications.sourceMatchId))
    .innerJoin(stageContainers, eq(stageContainers.id, sql`coalesce(${stageQualifications.sourceContainerId}, ${matches.containerId})`))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(
      and(
        eq(entrants.teamId, teamId),
        eq(stageQualifications.destinationType, "placement"),
        isNotNull(stageQualifications.placement),
        lte(stageQualifications.placement, 3),
      ),
    )
    .orderBy(desc(tournaments.endDate));

  const items = rows.filter((r): r is typeof r & { placement: number } => r.placement != null);

  return {
    items,
    titles: items.filter((r) => r.placement === 1).length,
    podiums: items.length,
  };
}

export type TeamStatsPlayer = { id: number; handle: string; countryCode: string | null; secondaryCountryCode: string | null };

/** Handles (+ nationality, used by the tournament stats table's Nationality column) for the personIds a team's/tournament's aggregated stats rows reference. */
export async function getPeopleHandles(personIds: number[]): Promise<Map<number, TeamStatsPlayer>> {
  if (personIds.length === 0) return new Map();
  const rows = await db
    .select({ id: people.id, handle: people.handle, countryCode: people.countryCode, secondaryCountryCode: people.secondaryCountryCode })
    .from(people)
    .where(inArray(people.id, personIds));
  return new Map(rows.map((r) => [r.id, r]));
}

export type TeamPressItem = {
  title: string;
  slug: string;
  publisher: string;
  publishedAt: Date | null;
  lang: string;
};

/** Not customizable here (only the /news listing page exposes the language filter) — always the site-locale + English default rule. */
export async function getTeamPress(teamId: number, locale: AppLocale, limit = 5): Promise<TeamPressItem[]> {
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
    .where(and(eq(newsRelations.relatableType, "team"), eq(newsRelations.relatableId, teamId), isNewsPublishedCondition(), inArray(news.lang, languages)))
    .orderBy(desc(news.publishedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, publisher: r.publisher ?? "GC-Stats" }));
}
