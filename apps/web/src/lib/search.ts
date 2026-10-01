/**
 * GC-Stats - search
 *
 * Global search, a straight port of V1's App\Services\SearchService::search():
 * same two-pass shape (rank/limit candidates in SQL, then re-score/sort in
 * memory), same score formula (exact prefix, exact substring, length
 * proximity, popularity from `page_views`), same active-tournaments-only
 * filter. Adds on top of V1: special-char folding (so "remake" also matches
 * "Re//make") and an `organization` result type, matched on name and slug.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { teams, people, tournaments, organizations, pageViews } from "@gc-stats/db";
import { typoVariants, stripAccents, stripSpecialChars } from "@/lib/search-typo";
import { specialCharFoldedIlike, specialCharPrefixRank } from "@/lib/db-search";
import { getEntityLogosBatch, themedLogoUrls } from "@/lib/admin-logos";
import { slugify } from "@/lib/entity-id";
import { teamLogo, teamLogoLight, DEFAULT_TOURNAMENT_LOGO } from "@/lib/home-fake-data";
import { abbreviateTournamentName } from "@/lib/home-data";
import { visibleTeam, visiblePerson, visibleTournament } from "@/lib/ghost-visibility";

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
  /** Raw page-view count over the last 30 days (0 until page-view tracking exists) — same field V1 exposes for its "sort by popularity" option. */
  popularity: number;
};

export type SearchResults = Record<SearchResultType, SearchResultItem[]>;

const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 100;
const EMPTY_RESULTS: SearchResults = { team: [], player: [], tournament: [], organization: [] };
const POPULARITY_WINDOW_DAYS = 30;
const POPULARITY_CAP = 200;

// `term` here is already accent-stripped AND special-char-stripped (see
// searchGlobal's `base`) — folding the candidate name the same way lets
// "remake" match "Re//make" and "g2gozen" match "G2 Gozen" on top of V1's
// original accent/typo folding.
function scoreMatch(name: string, term: string, termLen: number, views: number): number {
  const folded = stripSpecialChars(stripAccents(name.toLowerCase()));
  const diff = Math.abs(name.length - termLen);
  return (folded.startsWith(term) ? 1000 : 0) + (folded.includes(term) ? 75 : 0) + Math.max(0, 100 - diff * 10) + Math.min(Math.floor(views / 10), POPULARITY_CAP);
}

export async function searchGlobal(rawTerm: string, opts: { perTypeLimit?: number; candidateLimit?: number } = {}): Promise<SearchResults> {
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

  const [teamRows, playerRows, tournamentRows, organizationRows] = await Promise.all([
    db
      .select({ id: teams.id, name: teams.name, shortName: teams.shortName, countryCode: teams.countryCode, secondaryCountryCode: teams.secondaryCountryCode })
      .from(teams)
      .where(and(visibleTeam, or(...variants.flatMap((v) => [specialCharFoldedIlike(teams.name, v), specialCharFoldedIlike(teams.shortName, v)]))))
      .orderBy(specialCharPrefixRank(teams.name, base))
      .limit(candidateLimit),
    db
      .select({ id: people.id, handle: people.handle, countryCode: people.countryCode, secondaryCountryCode: people.secondaryCountryCode })
      .from(people)
      .where(and(visiblePerson, or(...variants.map((v) => specialCharFoldedIlike(people.handle, v)))))
      .orderBy(specialCharPrefixRank(people.handle, base))
      .limit(candidateLimit),
    db
      .select({ id: tournaments.id, name: tournaments.name, region: tournaments.region })
      .from(tournaments)
      // V1 only ever searches active tournaments (Tournament::where('active', true)).
      .where(and(eq(tournaments.active, true), visibleTournament, or(...variants.map((v) => specialCharFoldedIlike(tournaments.name, v)))))
      .orderBy(specialCharPrefixRank(tournaments.name, base))
      .limit(candidateLimit),
    db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, countryCode: organizations.countryCode, secondaryCountryCode: organizations.secondaryCountryCode })
      .from(organizations)
      .where(
        // The slug is always already special-char-free (see packages/db/src/schema/people.ts)
        // — matching it directly catches cases where it diverges from a naive
        // fold of the name, on top of the folded name match.
        or(...variants.flatMap((v) => [specialCharFoldedIlike(organizations.name, v), specialCharFoldedIlike(organizations.slug, v)]))
      )
      .orderBy(specialCharPrefixRank(organizations.name, base))
      .limit(candidateLimit),
  ]);

  const [teamLogos, personLogos, tournamentLogos, organizationLogos] = await Promise.all([
    getEntityLogosBatch("team", teamRows.map((t) => t.id)),
    getEntityLogosBatch("person", playerRows.map((p) => p.id)),
    getEntityLogosBatch("tournament", tournamentRows.map((t) => t.id)),
    getEntityLogosBatch("organization", organizationRows.map((o) => o.id)),
  ]);

  // Mirrors V1's DB::table('page_views')->whereIn('uri', $uris)->where('viewed_at', '>=', now()->subDays(30))
  // — same bare "type/id" URI convention V1 hardcodes for this lookup (its
  // real routes carry a slug too; this table isn't populated by any page-view
  // tracker yet on either side, so every popularity term is 0 for now).
  const uriFor = (type: SearchResultType, id: number) => `${type}/${id}`;
  const allUris = [
    ...teamRows.map((t) => uriFor("team", t.id)),
    ...playerRows.map((p) => uriFor("player", p.id)),
    ...tournamentRows.map((t) => uriFor("tournament", t.id)),
    ...organizationRows.map((o) => uriFor("organization", o.id)),
  ];
  const viewRows = allUris.length
    ? await db
        .select({ uri: pageViews.uri, total: sql<number>`SUM(${pageViews.count})` })
        .from(pageViews)
        .where(and(inArray(pageViews.uri, allUris), sql`${pageViews.viewedAt} >= CURRENT_DATE - ${sql.raw(`INTERVAL '${POPULARITY_WINDOW_DAYS} days'`)}`))
        .groupBy(pageViews.uri)
    : [];
  const viewsByUri = new Map(viewRows.map((r) => [r.uri, Number(r.total)]));

  const team: SearchResultItem[] = teamRows
    .map((t) => {
      const views = viewsByUri.get(uriFor("team", t.id)) ?? 0;
      const score = Math.max(scoreMatch(t.name, base, termLen, views), t.shortName ? scoreMatch(t.shortName, base, termLen, views) : 0);
      return { row: t, score, views };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, perTypeLimit)
    .map(({ row: t, score, views }) => ({
      type: "team" as const,
      id: t.id,
      title: t.name,
      subtitle: t.shortName,
      countryCode: t.countryCode,
      secondaryCountryCode: t.secondaryCountryCode,
      logoUrl: themedLogoUrls(teamLogos.get(t.id) ?? [], "team").dark ?? teamLogo(t.shortName ?? ""),
      logoUrlLight: themedLogoUrls(teamLogos.get(t.id) ?? [], "team").light ?? teamLogoLight(t.shortName ?? ""),
      // team/player use a separate id/slug segment pair (/team/{id}/{slug}), same as tournaments.
      path: `team/${t.id}/${slugify(t.name)}`,
      score,
      popularity: views,
    }));

  const player: SearchResultItem[] = playerRows
    .map((p) => {
      const views = viewsByUri.get(uriFor("player", p.id)) ?? 0;
      return { row: p, score: scoreMatch(p.handle, base, termLen, views), views };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, perTypeLimit)
    .map(({ row: p, score, views }) => ({
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
      popularity: views,
    }));

  const tournament: SearchResultItem[] = tournamentRows
    .map((t) => {
      const views = viewsByUri.get(uriFor("tournament", t.id)) ?? 0;
      return { row: t, score: scoreMatch(t.name, base, termLen, views), views };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, perTypeLimit)
    .map(({ row: t, score, views }) => ({
      type: "tournament" as const,
      id: t.id,
      title: abbreviateTournamentName(t.name),
      subtitle: t.region,
      countryCode: null,
      secondaryCountryCode: null,
      logoUrl: themedLogoUrls(tournamentLogos.get(t.id) ?? [], "tournament").dark ?? DEFAULT_TOURNAMENT_LOGO,
      logoUrlLight: themedLogoUrls(tournamentLogos.get(t.id) ?? [], "tournament").light ?? DEFAULT_TOURNAMENT_LOGO,
      path: `tournaments/${t.id}/${slugify(t.name)}`,
      score,
      popularity: views,
    }));

  const organization: SearchResultItem[] = organizationRows
    .map((o) => {
      const views = viewsByUri.get(uriFor("organization", o.id)) ?? 0;
      const score = Math.max(scoreMatch(o.name, base, termLen, views), scoreMatch(o.slug, base, termLen, views));
      return { row: o, score, views };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, perTypeLimit)
    .map(({ row: o, score, views }) => ({
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
      popularity: views,
    }));

  return { team, player, tournament, organization };
}

export function searchResultCount(results: SearchResults): number {
  return results.team.length + results.player.length + results.tournament.length + results.organization.length;
}
