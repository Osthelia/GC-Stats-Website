/**
 * GC-Stats - production-credits-data
 *
 * Data layer for production credits: dashboard management queries plus the
 * paginated/sortable public "Production" tabs on org, tournament and player
 * pages, all resolving through a shared row shape and target resolver.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import {
  productionCredits,
  people,
  organizations,
  tournaments,
  matches,
  entrants,
  stageContainers,
  stages,
} from "@gc-stats/db";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";

export type OrgProductionCredit = {
  id: number;
  personId: number;
  handle: string;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  role: string;
  titleOverride: string | null;
  /** Exactly one of these two is set, mirroring the exactly-one-of-5 CHECK on production_credits (only tournament/match are exposed from /dashboard, see production-credit-validation.ts). */
  target:
    | { scope: "tournament"; tournamentId: number; tournamentName: string }
    | {
        scope: "match";
        matchId: number;
        tournamentId: number | null;
        tournamentName: string | null;
        label: string;
      };
};

/** Every match label the way admin-matches.ts's listTournamentMatches would compute it, but for an arbitrary set of match ids scattered across tournaments — used to resolve production_credits rows pointing at matchId. */
export async function resolveMatchTargets(matchIds: number[]) {
  if (matchIds.length === 0)
    return new Map<
      number,
      {
        tournamentId: number | null;
        tournamentName: string | null;
        label: string;
        scheduledAt: Date | null;
      }
    >();

  const entrantA = alias(entrants, "target_entrant_a");
  const entrantB = alias(entrants, "target_entrant_b");
  const matchRows = await db
    .select({
      id: matches.id,
      scheduledAt: matches.scheduledAt,
      tournamentId: stages.tournamentId,
      tournamentName: tournaments.name,
      aName: entrantA.displayName,
      bName: entrantB.displayName,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .leftJoin(entrantA, eq(entrantA.id, matches.entrantAId))
    .leftJoin(entrantB, eq(entrantB.id, matches.entrantBId))
    .where(inArray(matches.id, matchIds));

  const result = new Map<
    number,
    {
      tournamentId: number | null;
      tournamentName: string | null;
      label: string;
      scheduledAt: Date | null;
    }
  >();
  for (const m of matchRows) {
    result.set(m.id, {
      tournamentId: m.tournamentId,
      tournamentName: m.tournamentName,
      label: `${m.aName ?? "TBD"} vs ${m.bName ?? "TBD"}`,
      scheduledAt: m.scheduledAt,
    });
  }
  return result;
}

/** /dashboard management only (see components/dashboard/org-production-credits-panel.tsx) — the public site reads through `getOrganizationProductionsPage` instead, see below. */
export async function getOrganizationProductionCredits(
  organizationId: number,
): Promise<OrgProductionCredit[]> {
  const rows = await db
    .select({
      id: productionCredits.id,
      personId: people.id,
      handle: people.handle,
      countryCode: people.countryCode,
      secondaryCountryCode: people.secondaryCountryCode,
      role: productionCredits.role,
      titleOverride: productionCredits.titleOverride,
      tournamentId: productionCredits.tournamentId,
      matchId: productionCredits.matchId,
    })
    .from(productionCredits)
    .innerJoin(people, eq(people.id, productionCredits.personId))
    .where(eq(productionCredits.organizationId, organizationId))
    .orderBy(desc(productionCredits.id));

  const tournamentIds = [
    ...new Set(
      rows.map((r) => r.tournamentId).filter((id): id is number => id !== null),
    ),
  ];
  const tournamentRows = tournamentIds.length
    ? await db
        .select({ id: tournaments.id, name: tournaments.name })
        .from(tournaments)
        .where(inArray(tournaments.id, tournamentIds))
    : [];
  const tournamentById = new Map(tournamentRows.map((t) => [t.id, t.name]));

  const matchIds = rows
    .map((r) => r.matchId)
    .filter((id): id is number => id !== null);
  const matchTargetById = await resolveMatchTargets(matchIds);

  return rows.flatMap((r): OrgProductionCredit[] => {
    const base = {
      id: r.id,
      personId: r.personId,
      handle: r.handle,
      countryCode: r.countryCode,
      secondaryCountryCode: r.secondaryCountryCode,
      role: r.role,
      titleOverride: r.titleOverride,
    };
    if (r.tournamentId !== null) {
      const tournamentName = tournamentById.get(r.tournamentId);
      if (!tournamentName) return []; // dangling reference (tournament deleted) — skip rather than crash the page
      return [
        {
          ...base,
          target: {
            scope: "tournament",
            tournamentId: r.tournamentId,
            tournamentName,
          },
        },
      ];
    }
    if (r.matchId !== null) {
      const info = matchTargetById.get(r.matchId);
      if (!info) return [];
      return [
        {
          ...base,
          target: {
            scope: "match",
            matchId: r.matchId,
            tournamentId: info.tournamentId,
            tournamentName: info.tournamentName,
            label: info.label,
          },
        },
      ];
    }
    return [];
  });
}

export async function getMatchTournamentId(
  matchId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ tournamentId: stages.tournamentId })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(matches.id, matchId))
    .limit(1);
  return row?.tournamentId ?? null;
}

export type CreditMatchOption = { id: number; label: string };

/** Backs the Match <Select> once a tournament is picked in the add-credit form — plain read, no search-as-you-type needed since a tournament rarely has more than a few dozen matches. */
export async function getTournamentMatchOptionsForCredit(
  tournamentId: number,
): Promise<CreditMatchOption[]> {
  const containerRows = await db
    .select({ id: stageContainers.id })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId));
  if (containerRows.length === 0) return [];

  const matchRows = await db
    .select({
      id: matches.id,
      round: matches.round,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
    })
    .from(matches)
    .where(
      inArray(
        matches.containerId,
        containerRows.map((c) => c.id),
      ),
    )
    .orderBy(matches.round, matches.id);

  const entrantIds = [
    ...new Set(
      matchRows
        .flatMap((m) => [m.entrantAId, m.entrantBId])
        .filter((id): id is number => id !== null),
    ),
  ];
  const entrantRows = entrantIds.length
    ? await db
        .select({ id: entrants.id, displayName: entrants.displayName })
        .from(entrants)
        .where(inArray(entrants.id, entrantIds))
    : [];
  const entrantById = new Map(entrantRows.map((e) => [e.id, e.displayName]));

  return matchRows.map((m) => {
    const aName =
      m.entrantAId !== null ? (entrantById.get(m.entrantAId) ?? "TBD") : "TBD";
    const bName =
      m.entrantBId !== null ? (entrantById.get(m.entrantBId) ?? "TBD") : "TBD";
    return { id: m.id, label: `${aName} vs ${bName} (R${m.round})` };
  });
}

// --- Public "Production" lists (org page / tournament page / people page) ---
// Distinct from OrgProductionCredit above: these three pages are paginated
// and sortable, share one row shape + one sort/paginate helper, and — unlike
// /dashboard — never call anything "production credit(s)" in user-facing
// text (explicit request): the section is titled "Production" everywhere.

export type ProductionEntry = {
  id: number;
  role: string;
  titleOverride: string | null;
  /** Tournament start date (tournament-level entry) or match kickoff (match-level entry) — whichever the entry is dated by. Null when neither is known yet. */
  date: Date | null;
  person: {
    id: number;
    handle: string;
    countryCode: string | null;
    secondaryCountryCode: string | null;
  };
  organization: {
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    logoUrlLight: string | null;
  } | null;
  target:
    | { scope: "tournament"; tournamentId: number; tournamentName: string }
    | {
        scope: "match";
        matchId: number;
        tournamentId: number | null;
        tournamentName: string | null;
        label: string;
      };
};

export type ProductionSortDirection = "asc" | "desc";

type RawProductionRow = {
  id: number;
  role: string;
  titleOverride: string | null;
  personId: number;
  organizationId: number | null;
  tournamentId: number | null;
  matchId: number | null;
};

async function resolveTournamentNamesAndDates(
  tournamentIds: number[],
): Promise<Map<number, { name: string; startDate: Date | null }>> {
  if (tournamentIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      startDate: tournaments.startDate,
    })
    .from(tournaments)
    .where(inArray(tournaments.id, tournamentIds));
  return new Map(
    rows.map((t) => [
      t.id,
      { name: t.name, startDate: t.startDate ? new Date(t.startDate) : null },
    ]),
  );
}

/** Batch-resolves person/organization/tournament/match info for a set of raw production_credits rows — shared by the org/tournament/person "Production" pages below. */
async function resolveProductionEntries(
  rows: RawProductionRow[],
): Promise<ProductionEntry[]> {
  const personIds = [...new Set(rows.map((r) => r.personId))];
  const orgIds = [
    ...new Set(
      rows
        .map((r) => r.organizationId)
        .filter((id): id is number => id !== null),
    ),
  ];
  const matchIds = rows
    .map((r) => r.matchId)
    .filter((id): id is number => id !== null);
  // Match entries carry their own tournament name, only tournament level entries need this lookup.
  const directTournamentIds = [
    ...new Set(
      rows
        .map((r) => r.tournamentId)
        .filter((id): id is number => id !== null),
    ),
  ];

  const [personRows, orgRows, logosByOrgId, matchTargetById, tournamentInfoById] =
    await Promise.all([
      personIds.length
        ? db
            .select({
              id: people.id,
              handle: people.handle,
              countryCode: people.countryCode,
              secondaryCountryCode: people.secondaryCountryCode,
            })
            .from(people)
            .where(inArray(people.id, personIds))
        : [],
      orgIds.length
        ? db
            .select({
              id: organizations.id,
              name: organizations.name,
              slug: organizations.slug,
            })
            .from(organizations)
            .where(inArray(organizations.id, orgIds))
        : [],
      getCurrentLogoUrlsThemed("organization", orgIds),
      resolveMatchTargets(matchIds),
      resolveTournamentNamesAndDates(directTournamentIds),
    ]);

  const personById = new Map(personRows.map((p) => [p.id, p]));
  const orgById = new Map(
    orgRows.map((o) => [
      o.id,
      {
        id: o.id,
        name: o.name,
        slug: o.slug,
        logoUrl: logosByOrgId.get(o.id)?.dark ?? null,
        logoUrlLight: logosByOrgId.get(o.id)?.light ?? null,
      },
    ]),
  );

  return rows.flatMap((r): ProductionEntry[] => {
    const person = personById.get(r.personId);
    if (!person) return []; // dangling reference — skip rather than crash the page
    const organization =
      r.organizationId !== null
        ? (orgById.get(r.organizationId) ?? null)
        : null;
    const base = {
      id: r.id,
      role: r.role,
      titleOverride: r.titleOverride,
      person,
      organization,
    };

    if (r.tournamentId !== null) {
      const info = tournamentInfoById.get(r.tournamentId);
      if (!info) return [];
      return [
        {
          ...base,
          date: info.startDate,
          target: {
            scope: "tournament",
            tournamentId: r.tournamentId,
            tournamentName: info.name,
          },
        },
      ];
    }
    if (r.matchId !== null) {
      const m = matchTargetById.get(r.matchId);
      if (!m) return [];
      return [
        {
          ...base,
          date: m.scheduledAt,
          target: {
            scope: "match",
            matchId: r.matchId,
            tournamentId: m.tournamentId,
            tournamentName: m.tournamentName,
            label: m.label,
          },
        },
      ];
    }
    return [];
  });
}

const DEFAULT_PAGE_SIZE = 20;

type ProductionPageOpts<Sort extends string> = {
  page: number;
  sort: Sort;
  direction: ProductionSortDirection;
  role?: string | null;
  /** YYYY-MM-DD, validated by parseProductionParams, inclusive on both ends. */
  from?: string | null;
  to?: string | null;
  pageSize?: number;
};

/** `roles` lists every role present in the page's scope (ignoring the role filter), to feed the filter dropdown. */
export type ProductionPage = {
  items: ProductionEntry[];
  total: number;
  totalPages: number;
  page: number;
  roles: string[];
};

function sortRoles(roles: string[]): string[] {
  return [...new Set(roles)].sort((a, b) => a.localeCompare(b));
}

/**
 * Shared DB-level sort+paginate for the org/person "Production" pages: joins to both possible
 * date/name sources (a directly-linked tournament, or the one reached through the entry's match)
 * so ORDER BY/LIMIT run in Postgres instead of resolving and sorting every credit in memory.
 */
async function paginateProductionRows(
  scopeClause: SQL,
  opts: ProductionPageOpts<"tournament" | "target" | "date">,
): Promise<ProductionPage> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  const matchContainers = alias(stageContainers, "prod_match_containers");
  const matchStages = alias(stages, "prod_match_stages");
  const matchTournaments = alias(tournaments, "prod_match_tournaments");
  const matchEntrantA = alias(entrants, "prod_match_entrant_a");
  const matchEntrantB = alias(entrants, "prod_match_entrant_b");

  // Same date as the one displayed: tournament start, or match kickoff.
  const entryDate = sql`coalesce(${tournaments.startDate}, ${matches.scheduledAt})`;
  const sortName = sql`coalesce(${tournaments.name}, ${matchTournaments.name}, '')`;
  // Tournament level entries first, then matches by their "A vs B" label.
  const targetName = sql`case when ${productionCredits.tournamentId} is not null then '' else coalesce(${matchEntrantA.displayName}, 'TBD') || ' vs ' || coalesce(${matchEntrantB.displayName}, 'TBD') end`;
  const sortExpr = opts.sort === "date" ? entryDate : opts.sort === "target" ? targetName : sortName;
  // Undated entries always last, whatever the direction.
  const orderBy =
    opts.direction === "asc"
      ? sql`${sortExpr} asc nulls last`
      : sql`${sortExpr} desc nulls last`;

  const conditions: SQL[] = [scopeClause];
  if (opts.role) conditions.push(eq(productionCredits.role, opts.role));
  if (opts.from) conditions.push(sql`${entryDate} >= ${opts.from}::date`);
  if (opts.to) conditions.push(sql`${entryDate} < ${opts.to}::date + 1`);
  const whereClause = and(...conditions)!;

  const selectPage = (page: number) =>
    db
      .select({
        id: productionCredits.id,
        role: productionCredits.role,
        titleOverride: productionCredits.titleOverride,
        personId: productionCredits.personId,
        organizationId: productionCredits.organizationId,
        tournamentId: productionCredits.tournamentId,
        matchId: productionCredits.matchId,
      })
      .from(productionCredits)
      .leftJoin(tournaments, eq(tournaments.id, productionCredits.tournamentId))
      .leftJoin(matches, eq(matches.id, productionCredits.matchId))
      .leftJoin(matchContainers, eq(matchContainers.id, matches.containerId))
      .leftJoin(matchStages, eq(matchStages.id, matchContainers.stageId))
      .leftJoin(
        matchTournaments,
        eq(matchTournaments.id, matchStages.tournamentId),
      )
      .leftJoin(matchEntrantA, eq(matchEntrantA.id, matches.entrantAId))
      .leftJoin(matchEntrantB, eq(matchEntrantB.id, matches.entrantBId))
      .where(whereClause)
      .orderBy(orderBy, desc(productionCredits.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

  // The count needs the tournament/match joins too, the date filter reads them.
  const requestedPage = Math.max(1, opts.page);
  const [[countRow], roleRows, requestedRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(productionCredits)
      .leftJoin(tournaments, eq(tournaments.id, productionCredits.tournamentId))
      .leftJoin(matches, eq(matches.id, productionCredits.matchId))
      .where(whereClause),
    db
      .selectDistinct({ role: productionCredits.role })
      .from(productionCredits)
      .where(scopeClause),
    selectPage(requestedPage),
  ]);
  const total = countRow?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  // Only an out of range page needs a second query.
  const rows = page === requestedPage ? requestedRows : await selectPage(page);

  const items = await resolveProductionEntries(rows);
  return {
    items,
    total,
    totalPages,
    page,
    roles: sortRoles(roleRows.map((r) => r.role)),
  };
}

export type OrganizationProductionSort = "tournament" | "date";

/** Org page's "Production" tab — every production credit given on this organization's behalf, across all its tournaments. */
export async function getOrganizationProductionsPage(
  organizationId: number,
  opts: ProductionPageOpts<OrganizationProductionSort>,
): Promise<ProductionPage> {
  return paginateProductionRows(
    eq(productionCredits.organizationId, organizationId),
    opts,
  );
}

export type TournamentProductionSort = "target" | "date";

/** Tournament page's "Production" tab — production credits scoped to this tournament, whether given at the tournament level or on one of its matches. */
export async function getTournamentProductionsPage(
  tournamentId: number,
  opts: ProductionPageOpts<TournamentProductionSort>,
): Promise<ProductionPage> {
  const tournamentMatchIds = db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId));

  return paginateProductionRows(
    or(
      eq(productionCredits.tournamentId, tournamentId),
      inArray(productionCredits.matchId, tournamentMatchIds),
    )!,
    opts,
  );
}

export type PersonProductionSort = "tournament" | "date";

/** People page's "Production" tab — every production this person has been credited on, across every organization. */
export async function getPersonProductionsPage(
  personId: number,
  opts: ProductionPageOpts<PersonProductionSort>,
): Promise<ProductionPage> {
  return paginateProductionRows(eq(productionCredits.personId, personId), opts);
}
