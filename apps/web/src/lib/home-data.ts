/**
 * GC-Stats - home-data
 *
 * Home page data: match schedule/results windowed around "now" (past 30d,
 * future 2d) with pagination, home news feed, and active tournament groups.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { desc, eq, asc, and, gte, lt, lte, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { unstable_cache } from "next/cache";
import { db } from "@gc-stats/db/client";
import { matches, entrants, tournaments, stageContainers, stages } from "@gc-stats/db";
import { news, organizations } from "@gc-stats/db";
import { visibleTournament } from "@/lib/ghost-visibility";
import { normalizeRegion, type RegionKey, type MatchStatus } from "@/lib/home-fake-data";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { buildTeamDisplayResolver } from "@/lib/historical-team-display";
import { slugify } from "@/lib/entity-id";
import { formatSideScore } from "@/lib/match-score-format";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { HOME_TOURNAMENTS_TAG } from "@/lib/cache-tags";
import { compareDayOrder, sortDayMatches } from "@/lib/home-day-order";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

const MATCH_STATUS: Record<string, MatchStatus> = { pending: "upcoming", live: "live", completed: "finished" };

const INTL_LOCALE: Record<AppLocale, string> = { fr: "fr-FR", en: "en-US", es: "es-ES", pt: "pt-BR", tr: "tr-TR", ja: "ja-JP", ko: "ko-KR", de: "de-DE", zh: "zh-CN", it: "it-IT", pl: "pl-PL", ar: "ar", th: "th-TH" };

// Display only — shortens "Game Changers <year>" to "GC <year>" (any year,
// requested explicitly for the home feed, now reused anywhere else a
// tournament name is shown the same way, e.g. the team page). The underlying
// `tournaments.name` rows keep their real migrated V1 names untouched.
export function abbreviateTournamentName(name: string): string {
  return name.replace(/Game Changers (\d{4})/g, "GC $1");
}

export type HomeMatch = {
  id: number;
  status: MatchStatus;
  time: string;
  format: string;
  region: RegionKey;
  aName: string;
  aTag: string;
  aScore: string;
  aLogoUrl: string | null;
  aLogoUrlLight: string | null;
  bName: string;
  bTag: string;
  bScore: string;
  bLogoUrl: string | null;
  bLogoUrlLight: string | null;
  leader: "a" | "b" | null;
  event: string;
  stage: string;
  scheduledAt: Date;
};

export type HomeDay = { dayKey: string; label: string; date: string; dayOffset: number; matches: HomeMatch[] };

export type HomeMatchDaysPage = { days: HomeDay[]; nextOffset: number; hasMore: boolean };

// `scheduledAt` as ISO string: unstable_cache round-trips through JSON.
type HomeMatchRow = Omit<HomeMatch, "scheduledAt"> & { scheduledAt: string };
type HomeMatchRowPage = { rows: HomeMatchRow[]; nextOffset: number; hasMore: boolean };

// The home feed only ever needs a window around "now" (recent results +
// upcoming schedule), never the full match history.
const HOME_WINDOW_DAYS_PAST = 30;
const HOME_WINDOW_DAYS_FUTURE = 2;
const HOME_MATCH_PAGE_SIZE = 50;
const HOME_MATCHES_REVALIDATE_SECONDS = 60;

const entrantA = alias(entrants, "entrant_a");
const entrantB = alias(entrants, "entrant_b");

/**
 * One page of the home feed, locale independent so it can be cached once.
 * `pastOffset` paginates the past window only: the future window (2 days) is
 * only on the first page, capped separately so a busy live day can never push
 * every past result off that page.
 */
async function fetchHomeMatchRows(firstPage: boolean, pastOffset: number, limit: number): Promise<HomeMatchRowPage> {
  const now = new Date();
  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  windowStart.setUTCDate(windowStart.getUTCDate() - HOME_WINDOW_DAYS_PAST);
  const windowEnd = new Date();
  windowEnd.setUTCHours(0, 0, 0, 0);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + HOME_WINDOW_DAYS_FUTURE);

  const baseQuery = () =>
    db
      .select({
        id: matches.id,
        status: matches.status,
        scheduledAt: matches.scheduledAt,
        bestOf: matches.bestOf,
        label: matches.label,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        region: tournaments.region,
        tournamentName: tournaments.name,
        entrantAId: matches.entrantAId,
        entrantBId: matches.entrantBId,
        aDisplayName: entrantA.displayName,
        aTeamId: entrantA.teamId,
        bDisplayName: entrantB.displayName,
        bTeamId: entrantB.teamId,
      })
      .from(matches)
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
      .innerJoin(entrantA, eq(entrantA.id, matches.entrantAId))
      .innerJoin(entrantB, eq(entrantB.id, matches.entrantBId));

  // One extra past row tells whether another page exists.
  const [futureRows, pastFetched] = await Promise.all([
    firstPage
      ? baseQuery()
          .where(and(gte(matches.scheduledAt, now), lte(matches.scheduledAt, windowEnd), visibleTournament))
          .orderBy(asc(matches.scheduledAt), matches.id)
          .limit(limit)
      : [],
    baseQuery()
      .where(and(gte(matches.scheduledAt, windowStart), lt(matches.scheduledAt, now), visibleTournament))
      .orderBy(desc(matches.scheduledAt), matches.id)
      .limit(limit + 1)
      .offset(pastOffset),
  ]);
  const pastLimit = limit - futureRows.length;
  const pastRows = pastFetched.slice(0, pastLimit);
  const all = [...pastRows, ...futureRows];

  const teamIds = all.flatMap((m) => [m.aTeamId, m.bTeamId]).filter((id): id is number => id !== null);
  const resolver = await buildTeamDisplayResolver(teamIds);

  const side = (teamId: number | null, displayName: string, at: Date) => {
    if (!teamId) return { name: displayName, tag: "?", logoUrl: null, logoUrlLight: null };
    const logos = resolver.logosAt(teamId, at);
    return { name: resolver.nameAt(teamId, at, displayName), tag: resolver.shortNameOf(teamId) ?? "?", logoUrl: logos.dark, logoUrlLight: logos.light };
  };

  const rows: HomeMatchRow[] = [];
  for (const m of all) {
    if (!m.scheduledAt) continue;
    const a = side(m.aTeamId, m.aDisplayName, m.scheduledAt);
    const b = side(m.bTeamId, m.bDisplayName, m.scheduledAt);
    const status = MATCH_STATUS[m.status] ?? "upcoming";
    const leader = status === "upcoming" || m.scoreA == null || m.scoreB == null || m.scoreA === m.scoreB ? null : m.scoreA > m.scoreB ? "a" : "b";
    rows.push({
      id: m.id,
      status,
      time: m.scheduledAt.toISOString().slice(11, 16),
      format: `BO${m.bestOf}`,
      region: normalizeRegion(m.region),
      aName: a.name,
      aTag: a.tag,
      aScore: formatSideScore(m.scoreA, m.entrantAId),
      aLogoUrl: a.logoUrl,
      aLogoUrlLight: a.logoUrlLight,
      bName: b.name,
      bTag: b.tag,
      bScore: formatSideScore(m.scoreB, m.entrantBId),
      bLogoUrl: b.logoUrl,
      bLogoUrlLight: b.logoUrlLight,
      leader,
      event: abbreviateTournamentName(m.tournamentName),
      stage: m.label ?? "",
      scheduledAt: m.scheduledAt.toISOString(),
    });
  }

  return { rows, nextOffset: pastOffset + pastRows.length, hasMore: pastFetched.length > pastLimit };
}

const getCachedHomeMatchRows = unstable_cache(fetchHomeMatchRows, ["home-match-rows"], { revalidate: HOME_MATCHES_REVALIDATE_SECONDS });

/** First page without `pastOffset`, then the previous page's `nextOffset`. */
export async function getHomeMatchDays(locale: AppLocale, pastOffset?: number): Promise<HomeMatchDaysPage> {
  const [page, t] = await Promise.all([getCachedHomeMatchRows(pastOffset === undefined, pastOffset ?? 0, HOME_MATCH_PAGE_SIZE), getTranslations({ locale, namespace: "home" })]);
  const todayText = t("today");
  const tomorrowText = t("tomorrow");
  const weekdayFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long" });
  const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short", day: "numeric", month: "short" });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dayMap = new Map<string, HomeDay>();
  for (const row of page.rows) {
    const scheduledAt = new Date(row.scheduledAt);
    const dayKey = row.scheduledAt.slice(0, 10);
    let day = dayMap.get(dayKey);
    if (!day) {
      // Offset from the day's own UTC midnight, not the match's time of day.
      const dayMidnight = new Date(`${dayKey}T00:00:00.000Z`);
      const dayOffset = Math.round((dayMidnight.getTime() - today.getTime()) / 86_400_000);
      const label = dayOffset === 0 ? todayText : dayOffset === 1 ? tomorrowText : weekdayFormat.format(scheduledAt);
      day = { dayKey, label, date: dateFormat.format(scheduledAt), dayOffset, matches: [] };
      dayMap.set(dayKey, day);
    }
    day.matches.push({ ...row, scheduledAt });
  }

  const days = [...dayMap.values()].sort(compareDayOrder);
  for (const day of days) day.matches = sortDayMatches(day.matches, day.dayOffset);
  return { days, nextOffset: page.nextOffset, hasMore: page.hasMore };
}

export type HomeNewsItem = {
  title: string;
  slug: string;
  excerpt?: string | null;
  publisher: string;
  publisherLogoUrl: string | null;
  publisherLogoUrlLight: string | null;
  date: string;
};

/** `languages`: the viewer's news languages (see `resolveNewsLanguages`). */
export async function getHomeNews(locale: AppLocale, languages: string[]): Promise<{ featured: HomeNewsItem | null; items: HomeNewsItem[] }> {
  const rows = await db
    .select({
      title: news.title,
      slug: news.slug,
      excerpt: news.excerpt,
      isFeatured: news.isFeatured,
      publishedAt: news.publishedAt,
      organizationId: news.organizationId,
      publisher: organizations.name,
    })
    .from(news)
    .leftJoin(organizations, eq(organizations.id, news.organizationId))
    .where(and(isNewsPublishedCondition(), eq(news.showOnHome, true), inArray(news.lang, languages)))
    .orderBy(desc(news.publishedAt))
    .limit(6);

  const logosByOrgId = await getCurrentLogoUrlsThemed(
    "organization",
    rows.map((r) => r.organizationId).filter((id): id is number => id !== null)
  );

  const toItem = (r: (typeof rows)[number]): HomeNewsItem => ({
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    publisher: r.publisher ?? "GC-Stats",
    publisherLogoUrl: r.organizationId ? (logosByOrgId.get(r.organizationId)?.dark ?? null) : null,
    publisherLogoUrlLight: r.organizationId ? (logosByOrgId.get(r.organizationId)?.light ?? null) : null,
    date: r.publishedAt ? r.publishedAt.toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" }) : "",
  });

  const featuredRow = rows.find((r) => r.isFeatured);
  const rest = rows.filter((r) => !r.isFeatured).slice(0, 4);

  return { featured: featuredRow ? toItem(featuredRow) : null, items: rest.map(toItem) };
}

export type HomeTournament = {
  id: number;
  slug: string;
  name: string;
  region: string;
  regionColor: string;
  dates: string;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

// Plain objects only (no Map): unstable_cache stores JSON.
const getActiveHomeTournaments = unstable_cache(
  async () => {
    const rows = await db
      .select({ id: tournaments.id, name: tournaments.name, region: tournaments.region, status: tournaments.status, startDate: tournaments.startDate, endDate: tournaments.endDate })
      .from(tournaments)
      .where(and(eq(tournaments.active, true), visibleTournament, inArray(tournaments.status, ["live", "upcoming"])))
      .orderBy(asc(tournaments.startDate));
    const logosByTournamentId = await getCurrentLogoUrlsThemed("tournament", rows.map((t) => t.id));
    return rows.map((t) => ({ ...t, logoUrl: logosByTournamentId.get(t.id)?.dark ?? null, logoUrlLight: logosByTournamentId.get(t.id)?.light ?? null }));
  },
  ["home-tournaments"],
  { revalidate: 300, tags: [HOME_TOURNAMENTS_TAG] }
);

export async function getHomeTournamentGroups(regions: Record<RegionKey, { label: string; color: string }>, locale: AppLocale): Promise<{ label: "ongoing" | "upcomingGroup"; items: HomeTournament[] }[]> {
  const rows = await getActiveHomeTournaments();
  const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short" });
  const fmt = (d: string) => dateFormat.format(new Date(d));

  const toTournament = (t: (typeof rows)[number]): HomeTournament => {
    // normalizeRegion always returns a key of REGIONS ("other" when unknown).
    const region = regions[normalizeRegion(t.region)];
    // Slug from the real name, same as the tournament page's basePath.
    return {
      id: t.id,
      slug: slugify(t.name),
      name: abbreviateTournamentName(t.name),
      region: region.label,
      regionColor: region.color,
      dates: `${fmt(t.startDate)} – ${fmt(t.endDate)}`,
      logoUrl: t.logoUrl,
      logoUrlLight: t.logoUrlLight,
    };
  };

  return [
    { label: "ongoing", items: rows.filter((t) => t.status === "live").map(toTournament) },
    { label: "upcomingGroup", items: rows.filter((t) => t.status === "upcoming").map(toTournament) },
  ];
}
