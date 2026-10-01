/**
 * GC-Stats - tournament-list-data
 *
 * Public tournaments listing page: paginated, filterable (region, category,
 * year) and sortable query, mirroring V1's public TournamentController::index()
 * behavior with a denser per-page card grid.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@gc-stats/db/client";
import { tournaments, entrants } from "@gc-stats/db";
import { visibleTournament } from "@/lib/ghost-visibility";
import { qualifiedColumn } from "@/lib/db-search";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { TOURNAMENT_FACETS_TAG } from "@/lib/cache-tags";

export type TournamentListSort = "date" | "name";
export type SortDirection = "asc" | "desc";

export type TournamentListRow = {
  id: number;
  name: string;
  region: string | null;
  category: string | null;
  prizePool: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  status: string;
  teamsCount: number;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

// V1's index paginates 12 big hero cards/page — V2 uses a denser card grid
// instead (see tournaments/page.tsx), so more fit comfortably per page.
const PAGE_SIZE = 24;

const teamsCountSql = sql<number>`(
  SELECT COUNT(*) FROM ${entrants} e
  WHERE e.tournament_id = ${qualifiedColumn(tournaments, "id")} AND e.kind = 'team'
)`;

// Filter options only change through the admin tournament actions, which invalidate the tag.
const getTournamentFacets = unstable_cache(
  async (): Promise<{ regions: string[]; categories: string[]; years: number[] }> => {
    const [regionRows, categoryRows, yearRows] = await Promise.all([
      db.selectDistinct({ region: tournaments.region }).from(tournaments).where(and(eq(tournaments.active, true), visibleTournament, sql`${tournaments.region} IS NOT NULL`)),
      db.selectDistinct({ category: tournaments.category }).from(tournaments).where(and(eq(tournaments.active, true), visibleTournament, sql`${tournaments.category} IS NOT NULL`)),
      db
        .selectDistinct({ year: sql<number>`EXTRACT(YEAR FROM ${tournaments.startDate})::int` })
        .from(tournaments)
        .where(and(eq(tournaments.active, true), visibleTournament)),
    ]);
    return {
      regions: regionRows.map((r) => r.region!).sort(),
      categories: categoryRows.map((r) => r.category!).sort(),
      years: yearRows.map((r) => r.year).sort((a, b) => b - a),
    };
  },
  ["tournament-facets"],
  { tags: [TOURNAMENT_FACETS_TAG], revalidate: 3600 },
);

// Mirrors V1's public TournamentController::index() exactly: only active
// tournaments are listed, region/category are exact matches, year filters on
// the calendar year of start_date, sort is date (start_date) or name, 12/page.
export async function listPublicTournaments(opts: {
  region: string;
  category: string;
  year: string;
  sort: TournamentListSort;
  direction: SortDirection;
  page: number;
}): Promise<{ rows: TournamentListRow[]; total: number; regions: string[]; categories: string[]; years: number[] }> {
  const conditions = [eq(tournaments.active, true), visibleTournament];
  if (opts.region) conditions.push(eq(tournaments.region, opts.region));
  if (opts.category) conditions.push(eq(tournaments.category, opts.category));
  if (opts.year && /^\d{4}$/.test(opts.year)) {
    conditions.push(sql`EXTRACT(YEAR FROM ${tournaments.startDate}) = ${Number(opts.year)}`);
  }
  const where = and(...conditions);

  const orderCol = opts.sort === "name" ? tournaments.name : tournaments.startDate;
  const orderFn = opts.direction === "asc" ? asc : desc;

  const [rows, totalRow, facets] = await Promise.all([
    db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        region: tournaments.region,
        category: tournaments.category,
        prizePool: tournaments.prizePool,
        location: tournaments.location,
        startDate: tournaments.startDate,
        endDate: tournaments.endDate,
        status: tournaments.status,
        teamsCount: teamsCountSql,
      })
      .from(tournaments)
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)` }).from(tournaments).where(where),
    getTournamentFacets(),
  ]);

  const logosByTournamentId = await getCurrentLogoUrlsThemed("tournament", rows.map((r) => r.id));

  return {
    rows: rows.map((r) => ({ ...r, logoUrl: logosByTournamentId.get(r.id)?.dark ?? null, logoUrlLight: logosByTournamentId.get(r.id)?.light ?? null })),
    total: Number(totalRow[0]?.count ?? 0),
    ...facets,
  };
}

export const TOURNAMENTS_PAGE_SIZE = PAGE_SIZE;
