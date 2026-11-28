/**
 * GC-Stats - search
 *
 * Global search, a straight port of V1's App\Services\SearchService::search():
 * same two-pass shape (rank/limit candidates in SQL, then re-score/sort in
 * memory), same score formula (exact prefix, exact substring, length
 * proximity, popularity), same active-tournaments-only
 * filter. Adds on top of V1: special-char folding (so "remake" also matches
 * "Re//make") and an `organization` result type, matched on name and slug.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizations, gameTables } from "@gc-stats/db";
import { organizationHasNoTeam } from "@/lib/organization-team-link";
import { typoVariants, stripAccents, stripSpecialChars } from "@/lib/search-typo";
import { specialCharFoldedIlike, specialCharFoldedArrayIlike, specialCharExactRank, specialCharPrefixRank } from "@/lib/db-search";
import { getEntityLogosBatch, themedLogoUrls } from "@/lib/admin-logos";
import { slugify } from "@/lib/entity-id";
import { defaultTeamLogos, defaultTournamentLogo } from "@/lib/default-logos";
import { abbreviateTournamentName } from "@/lib/home-data";
import { visibleTeam, visiblePerson, visibleTournament } from "@/lib/ghost-visibility";
import type { GameSlug } from "@gc-stats/db/game";
import { gameSqlTables, getPopularity } from "@/lib/search-popularity";

export type SearchResultType = "team" | "player" | "tournament" | "organization";

export type SearchResultItem = {
  type: SearchResultType;
  id: number;
  title: string;
  subtitle: string | null;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
  /** No leading slash, no locale — e.g. "team/45/team-liquid". Prefix with the current locale before rendering. */
  path: string;
  score: number;
  /** Recent activity of the entity (see search-popularity.ts), drives the "sort by popularity" option. */
  popularity: number;
};

export type SearchResults = Record<SearchResultType, SearchResultItem[]>;

const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 100;
const EMPTY_RESULTS: SearchResults = { team: [], player: [], tournament: [], organization: [] };
const POPULARITY_CAP = 50;
// Above the max score (~1575), so an inactive entity always ranks below every active one.
const INACTIVE_PENALTY = 2000;
// Full bonus for a player seen on a map in the last 30 days, fading out over a year.
const RECENCY_BONUS = 150;
const RECENCY_FULL_DAYS = 30;
const RECENCY_MAX_DAYS = 365;
// Covers both other bonuses, an exact handle stays ahead of a longer one that is more recent or popular.
const EXACT_MATCH_BONUS = RECENCY_BONUS + POPULARITY_CAP;

// Latest map (or game) the person played, falling back to the match schedule when it has no start time.
// The outer id is table qualified so the subquery always correlates with it.
const lastPlayedAtSql = (game: GameSlug) => {
  const t = gameSqlTables(game);
  return sql<string | null>`(
    select max(coalesce(sm.started_at, m.scheduled_at))
    from ${t.playerStats} s
    join ${t.series} sm on sm.id = s.${t.seriesKey}
    join ${t.matches} m on m.id = sm.match_id
    where s.person_id = ${t.people}.id
  )`;
};

export function recencyBonus(lastPlayed: Date | null, now: Date = new Date()): number {
  if (!lastPlayed) return 0;
  const days = (now.getTime() - lastPlayed.getTime()) / 86_400_000;
  if (days <= RECENCY_FULL_DAYS) return RECENCY_BONUS;
  if (days >= RECENCY_MAX_DAYS) return 0;
  return Math.round((RECENCY_BONUS * (RECENCY_MAX_DAYS - days)) / (RECENCY_MAX_DAYS - RECENCY_FULL_DAYS));
}

const inactivePenalty = (isActive: boolean) => (isActive ? 0 : INACTIVE_PENALTY);

// `term` here is already accent-stripped AND special-char-stripped (see
// searchGlobal's `base`) — folding the candidate name the same way lets
// "remake" match "Re//make" and "g2gozen" match "G2 Gozen" on top of V1's
// original accent/typo folding.
export function scoreMatch(name: string, term: string, termLen: number, popularity: number): number {
  const folded = stripSpecialChars(stripAccents(name.toLowerCase()));
  const diff = Math.abs(name.length - termLen);
  return (folded.startsWith(term) ? 1000 : 0) + (folded.includes(term) ? 75 : 0) + Math.max(0, 100 - diff * 10) + Math.min(popularity, POPULARITY_CAP);
}

export async function searchGlobal(game: GameSlug, rawTerm: string, opts: { perTypeLimit?: number; candidateLimit?: number } = {}): Promise<SearchResults> {
  const { teams, people, tournaments } = gameTables(game);
  // Defaults mirror V1's SearchService::search(perTypeLimit: 5, candidateLimit: 15)
  // — the header dropdown's defaults; the /search page passes SearchController's
  // own (50, 100) explicitly.
  const perTypeLimit = opts.perTypeLimit ?? 5;
  const candidateLimit = opts.candidateLimit ?? 15;

  const term = rawTerm.trim().toLowerCase().slice(0, MAX_TERM_LENGTH);
  if (term.length < MIN_TERM_LENGTH) return EMPTY_RESULTS;

  // typoVariants() itself only strips accents/known typo substitutions — it
  // still expects punctuation to match literally. Strip special chars from
  // every variant too so the DB query (specialCharFoldedIlike, which folds
  // the column the same way) actually finds "Re//make" for "remake".
  const variants = [...new Set(typoVariants(term).map(stripSpecialChars))].filter((v) => v.length > 0);
  // A term made entirely of punctuation (e.g. "//") strips to nothing — bail
  // rather than let an empty LIKE pattern ("%%") match every row.
  if (variants.length === 0) return EMPTY_RESULTS;
  const base = variants[0]!;
  const termLen = base.length;
  const lastPlayedAt = lastPlayedAtSql(game);

  const [teamRows, playerRows, tournamentRows, organizationRows] = await Promise.all([
    db
      .select({ id: teams.id, name: teams.name, shortName: teams.shortName, countryCode: teams.countryCode, secondaryCountryCode: teams.secondaryCountryCode, isActive: teams.isActive })
      .from(teams)
      .where(and(visibleTeam(game), or(...variants.flatMap((v) => [specialCharFoldedIlike(teams.name, v), specialCharFoldedIlike(teams.shortName, v)]))))
      .orderBy(desc(teams.isActive), specialCharPrefixRank(teams.name, base))
      .limit(candidateLimit),
    db
      .select({ id: people.id, handle: people.handle, countryCode: people.countryCode, secondaryCountryCode: people.secondaryCountryCode, isActive: people.isActive, lastPlayedAt })
      .from(people)
      .where(and(visiblePerson(game), or(...variants.map((v) => specialCharFoldedIlike(people.handle, v)))))
      // Exact handles come before recency, so the limit never drops them.
      .orderBy(desc(people.isActive), specialCharExactRank(people.handle, base), specialCharPrefixRank(people.handle, base), sql`${lastPlayedAt} desc nulls last`)
      .limit(candidateLimit),
    db
      .select({ id: tournaments.id, name: tournaments.name, region: tournaments.region })
      .from(tournaments)
      // V1 only ever searches active tournaments (Tournament::where('active', true)).
      .where(and(eq(tournaments.active, true), visibleTournament(game), or(...variants.flatMap((v) => [specialCharFoldedIlike(tournaments.name, v), specialCharFoldedArrayIlike(tournaments.keywords, v)]))))
      .orderBy(specialCharPrefixRank(tournaments.name, base))
      .limit(candidateLimit),
    db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, countryCode: organizations.countryCode, secondaryCountryCode: organizations.secondaryCountryCode })
      .from(organizations)
      .where(
        and(
          // The slug is always already special-char-free (see packages/db/src/schema/people.ts)
          // — matching it directly catches cases where it diverges from a naive
          // fold of the name, on top of the folded name match.
          or(...variants.flatMap((v) => [specialCharFoldedIlike(organizations.name, v), specialCharFoldedIlike(organizations.slug, v)])),
          // A team-linked organization has no public page.
          organizationHasNoTeam(game)
        )
      )
      .orderBy(specialCharPrefixRank(organizations.name, base))
      .limit(candidateLimit),
  ]);

  const [teamLogos, personLogos, tournamentLogos, organizationLogos] = await Promise.all([
    getEntityLogosBatch("team", teamRows.map((t) => t.id), game),
    getEntityLogosBatch("person", playerRows.map((p) => p.id)),
    getEntityLogosBatch("tournament", tournamentRows.map((t) => t.id), game),
    getEntityLogosBatch("organization", organizationRows.map((o) => o.id)),
  ]);

  const [teamPopularity, playerPopularity, tournamentPopularity, organizationPopularity] = await Promise.all([
    getPopularity(game, "team", teamRows.map((t) => t.id)),
    getPopularity(game, "player", playerRows.map((p) => p.id)),
    getPopularity(game, "tournament", tournamentRows.map((t) => t.id)),
    getPopularity(game, "organization", organizationRows.map((o) => o.id)),
  ]);

  const team: SearchResultItem[] = teamRows
    .map((t) => {
      const popularity = teamPopularity.get(t.id) ?? 0;
      const score = Math.max(scoreMatch(t.name, base, termLen, popularity), t.shortName ? scoreMatch(t.shortName, base, termLen, popularity) : 0) - inactivePenalty(t.isActive);
      return { row: t, score, popularity };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, perTypeLimit)
    .map(({ row: t, score, popularity }) => ({
      type: "team" as const,
      id: t.id,
      title: t.name,
      subtitle: t.shortName,
      countryCode: t.countryCode,
      secondaryCountryCode: t.secondaryCountryCode,
      logoUrl: themedLogoUrls(teamLogos.get(t.id) ?? [], "team").dark ?? defaultTeamLogos(game).dark,
      logoUrlLight: themedLogoUrls(teamLogos.get(t.id) ?? [], "team").light ?? defaultTeamLogos(game).light,
      // team/player use a separate id/slug segment pair (/team/{id}/{slug}), same as tournaments.
      path: `team/${t.id}/${slugify(t.name)}`,
      score,
      popularity,
    }));

  const player: SearchResultItem[] = playerRows
    .map((p) => {
      const popularity = playerPopularity.get(p.id) ?? 0;
      const exact = stripSpecialChars(stripAccents(p.handle.toLowerCase())) === base ? EXACT_MATCH_BONUS : 0;
      const recency = recencyBonus(p.lastPlayedAt ? new Date(p.lastPlayedAt) : null);
      return { row: p, score: scoreMatch(p.handle, base, termLen, popularity) + exact + recency - inactivePenalty(p.isActive), popularity };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, perTypeLimit)
    .map(({ row: p, score, popularity }) => ({
      type: "player" as const,
      id: p.id,
      title: p.handle,
      subtitle: null,
      countryCode: p.countryCode,
      secondaryCountryCode: p.secondaryCountryCode,
      logoUrl: themedLogoUrls(personLogos.get(p.id) ?? [], "person").dark,
      logoUrlLight: themedLogoUrls(personLogos.get(p.id) ?? [], "person").light,
      path: `player/${p.id}/${slugify(p.handle)}`,
      score,
      popularity,
    }));

  const tournament: SearchResultItem[] = tournamentRows
    .map((t) => {
      const popularity = tournamentPopularity.get(t.id) ?? 0;
      return { row: t, score: scoreMatch(t.name, base, termLen, popularity), popularity };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, perTypeLimit)
    .map(({ row: t, score, popularity }) => ({
      type: "tournament" as const,
      id: t.id,
      title: abbreviateTournamentName(t.name),
      subtitle: t.region,
      countryCode: null,
      secondaryCountryCode: null,
      logoUrl: themedLogoUrls(tournamentLogos.get(t.id) ?? [], "tournament").dark ?? defaultTournamentLogo(game),
      logoUrlLight: themedLogoUrls(tournamentLogos.get(t.id) ?? [], "tournament").light ?? defaultTournamentLogo(game),
      path: `tournaments/${t.id}/${slugify(t.name)}`,
      score,
      popularity,
    }));

  const organization: SearchResultItem[] = organizationRows
    .map((o) => {
      const popularity = organizationPopularity.get(o.id) ?? 0;
      const score = Math.max(scoreMatch(o.name, base, termLen, popularity), scoreMatch(o.slug, base, termLen, popularity));
      return { row: o, score, popularity };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, perTypeLimit)
    .map(({ row: o, score, popularity }) => ({
      type: "organization" as const,
      id: o.id,
      title: o.name,
      subtitle: null,
      countryCode: o.countryCode,
      secondaryCountryCode: o.secondaryCountryCode,
      logoUrl: themedLogoUrls(organizationLogos.get(o.id) ?? [], "organization").dark,
      logoUrlLight: themedLogoUrls(organizationLogos.get(o.id) ?? [], "organization").light,
      path: `organization/${o.id}/${o.slug}`,
      score,
      popularity,
    }));

  return { team, player, tournament, organization };
}

export function searchResultCount(results: SearchResults): number {
  return results.team.length + results.player.length + results.tournament.length + results.organization.length;
}
