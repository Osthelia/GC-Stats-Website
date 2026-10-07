/**
 * GC-Stats - admin-tournaments
 *
 * Admin queries for /admin/tournaments: paginated, filterable tournament
 * list with logos and status counts, plus detail lookup and point type
 * options.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { tournaments, pointTypes } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike, foldedArrayIlike } from "@/lib/db-search";
import { getCurrentLogoUrls } from "@/lib/admin-logos";

export type TournamentSort = "name" | "startDate" | "status";
export type SortDirection = "asc" | "desc";
export type TournamentStatus = "upcoming" | "live" | "finished";

/** Filterable columns for the "Filtrer" dialog on /admin/tournaments — free-text columns only, `name` is already covered by the main search box. */
export const TOURNAMENT_FILTER_FIELDS = ["region", "category", "status", "location"] as const;
export type TournamentFilterField = (typeof TOURNAMENT_FILTER_FIELDS)[number];
export type AdminTournamentFilter = { field: string; value: string };
/** "" = no filter on the `active` flag. */
export type TournamentActiveFilter = "" | "active" | "inactive";

function tournamentFilterColumn(field: string) {
  switch (field as TournamentFilterField) {
    case "region":
      return tournaments.region;
    case "category":
      return tournaments.category;
    case "status":
      return tournaments.status;
    case "location":
      return tournaments.location;
    default:
      return null;
  }
}

export type AdminTournamentRow = {
  id: number;
  name: string;
  logoUrl: string | null;
  region: string | null;
  category: string | null;
  startDate: string;
  endDate: string;
  status: string;
  active: boolean;
  isGhost: boolean;
};

export const TOURNAMENTS_PAGE_SIZE = 30;

export async function listAdminTournaments(opts: {
  q: string;
  sort: TournamentSort;
  direction: SortDirection;
  page: number;
  filters?: AdminTournamentFilter[];
  active?: TournamentActiveFilter;
}): Promise<{ rows: AdminTournamentRow[]; total: number }> {
  const { q, sort, direction, page, filters = [], active = "" } = opts;
  const conditions = [];

  if (active) conditions.push(eq(tournaments.active, active === "active"));

  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(tournaments.name, v), foldedArrayIlike(tournaments.keywords, v)]);
    if (numeric) clauses.push(eq(tournaments.id, Number(q)));
    conditions.push(or(...clauses));
  }

  for (const filter of filters) {
    const column = tournamentFilterColumn(filter.field);
    if (!column || !filter.value.trim()) continue;
    conditions.push(ilike(column, `%${filter.value.trim()}%`));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const sortCol = sort === "startDate" ? tournaments.startDate : sort === "status" ? tournaments.status : tournaments.name;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        region: tournaments.region,
        category: tournaments.category,
        startDate: tournaments.startDate,
        endDate: tournaments.endDate,
        status: tournaments.status,
        active: tournaments.active,
        isGhost: tournaments.isGhost,
      })
      .from(tournaments)
      .where(where)
      .orderBy(orderBy, asc(tournaments.id))
      .limit(TOURNAMENTS_PAGE_SIZE)
      .offset((page - 1) * TOURNAMENTS_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(tournaments).where(where),
  ]);

  const logoUrls = await getCurrentLogoUrls("tournament", rows.map((r) => r.id));

  return { rows: rows.map((r) => ({ ...r, logoUrl: logoUrls.get(r.id) ?? null })), total: Number(totalRows[0]?.total ?? 0) };
}

export async function getAdminTournamentCounts(): Promise<{ total: number; upcoming: number; live: number; finished: number }> {
  const rows = await db.select({ status: tournaments.status, count: sql<number>`count(*)::int` }).from(tournaments).groupBy(tournaments.status);
  const result = { total: 0, upcoming: 0, live: 0, finished: 0 };
  for (const row of rows) {
    result.total += row.count;
    if (row.status === "upcoming") result.upcoming = row.count;
    else if (row.status === "live") result.live = row.count;
    else if (row.status === "finished") result.finished = row.count;
  }
  return result;
}

export type AdminTournamentDetailRow = AdminTournamentRow & {
  logoUrl: string | null;
  prizePool: string | null;
  location: string | null;
  description: string | null;
  keywords: string[];
  liquipediaLink: string | null;
  socials: Record<string, string>;
  playerPovPhrase: string | null;
  pointTypeId: number | null;
};

// Cached per request: generateMetadata and the page both read it.
export const getAdminTournament = cache(async (id: number): Promise<AdminTournamentDetailRow | null> => {
  const [[row], logoUrls] = await Promise.all([db.select().from(tournaments).where(eq(tournaments.id, id)), getCurrentLogoUrls("tournament", [id])]);
  if (!row) return null;
  return { ...row, logoUrl: logoUrls.get(id) ?? null, socials: (row.socials as Record<string, string>) ?? {} };
});

export async function listPointTypeOptions(): Promise<{ id: number; name: string; label: string }[]> {
  return db.select({ id: pointTypes.id, name: pointTypes.name, label: pointTypes.label }).from(pointTypes).orderBy(asc(pointTypes.name));
}
