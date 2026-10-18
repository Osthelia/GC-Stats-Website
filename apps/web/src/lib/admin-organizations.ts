/**
 * GC-Stats - admin-organizations
 *
 * Admin queries for /admin/{game}/organizations: paginated list with member
 * counts, profile lookup, and full membership history per organization.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, exists, not, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { organizations, users, gameTables } from "@gc-stats/db";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike, qualifiedColumn } from "@/lib/db-search";
import { GAMES, type GameSlug } from "@gc-stats/db/game";

export type OrganizationSort = "name" | "members";
export type SortDirection = "asc" | "desc";

export type AdminOrganizationRow = {
  id: number;
  name: string;
  slug: string;
  tags: string[];
  countryCode: string | null;
  secondaryCountryCode: string | null;
  memberCount: number;
};

// Members of the game.
function memberCountSql(game: GameSlug) {
  const { organizationMemberships } = gameTables(game);
  return sql<number>`(
  SELECT COUNT(*) FROM ${organizationMemberships} om
  WHERE om.organization_id = ${qualifiedColumn(organizations, "id")} AND om.period @> CURRENT_DATE
)`;
}

// Games the organization is explicitly listed on.
function organizationOnGame(game: GameSlug) {
  return sql`${game} = ANY(${organizations.games})`;
}

// Teams linked to the organization, in any game.
function organizationHasTeamAnyGame() {
  return or(...GAMES.map((game) => {
    const { teams } = gameTables(game);
    return exists(db.select({ id: teams.id }).from(teams).where(eq(teams.organizationId, organizations.id)));
  }))!;
}

export const ORGANIZATIONS_PAGE_SIZE = 30;

export type OrganizationKind = "standalone" | "team";

export async function listAdminOrganizations(opts: { game: GameSlug; q: string; sort: OrganizationSort; direction: SortDirection; page: number; kind?: OrganizationKind }): Promise<{ rows: AdminOrganizationRow[]; total: number }> {
  const { game, q, sort, direction, page, kind } = opts;
  const conditions = [organizationOnGame(game)];

  // "team" = linked to at least one team (no public page), "standalone" = the others.
  if (kind === "team") conditions.push(organizationHasTeamAnyGame());
  if (kind === "standalone") conditions.push(not(organizationHasTeamAnyGame()));

  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(organizations.name, v), foldedIlike(organizations.slug, v)]);
    if (numeric) clauses.push(eq(organizations.id, Number(q)));
    conditions.push(or(...clauses)!);
  }

  const sortCol = sort === "members" ? memberCountSql(game) : organizations.name;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        tags: organizations.tags,
        countryCode: organizations.countryCode,
        secondaryCountryCode: organizations.secondaryCountryCode,
        memberCount: memberCountSql(game),
      })
      .from(organizations)
      .where(where)
      .orderBy(orderBy, asc(organizations.id))
      .limit(ORGANIZATIONS_PAGE_SIZE)
      .offset((page - 1) * ORGANIZATIONS_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(organizations).where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, tags: Array.isArray(r.tags) ? (r.tags as string[]) : [], memberCount: Number(r.memberCount) })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export type AdminOrganizationProfile = {
  id: number;
  name: string;
  slug: string;
  games: GameSlug[];
  tags: string[];
  countryCode: string | null;
  secondaryCountryCode: string | null;
  bio: string | null;
  liquipediaLink: string | null;
  socials: Record<string, string>;
  maxPermissions: string[];
};

export async function getAdminOrganization(id: number): Promise<AdminOrganizationProfile | null> {
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    games: row.games.filter((g): g is GameSlug => (GAMES as readonly string[]).includes(g)),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    countryCode: row.countryCode,
    secondaryCountryCode: row.secondaryCountryCode,
    bio: row.bio,
    liquipediaLink: row.liquipediaLink,
    socials: (row.socials as Record<string, string>) ?? {},
    maxPermissions: Array.isArray(row.maxPermissions) ? (row.maxPermissions as string[]) : [],
  };
}

export type AdminOrganizationMember = {
  membershipId: number;
  personId: number;
  handle: string;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  role: string;
  since: string | null;
  until: string | null;
  isCurrent: boolean;
  linkedUserId: string | null;
  linkedUsername: string | null;
};

/** Every stint, not just currently active memberships — mirrors getAdminTeamRoster (past join/left dates stay visible). */
export async function getAdminOrganizationMembers(game: GameSlug, organizationId: number): Promise<AdminOrganizationMember[]> {
  const { organizationMemberships, people } = gameTables(game);
  const rows = await db
    .select({
      membershipId: organizationMemberships.id,
      personId: people.id,
      handle: people.handle,
      countryCode: people.countryCode,
      secondaryCountryCode: people.secondaryCountryCode,
      role: organizationMemberships.role,
      period: organizationMemberships.period,
      linkedUserId: people.userId,
      linkedUsername: users.username,
    })
    .from(organizationMemberships)
    .innerJoin(people, eq(people.id, organizationMemberships.personId))
    .leftJoin(users, eq(users.id, people.userId))
    .where(eq(organizationMemberships.organizationId, organizationId))
    .orderBy(desc(organizationMemberships.id));

  return rows.map((r) => ({
    ...r,
    since: rangeLower(r.period),
    until: rangeUpper(r.period),
    isCurrent: rangeIsOpen(r.period),
  }));
}
