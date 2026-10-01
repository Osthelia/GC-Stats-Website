/**
 * GC-Stats - admin-organizations
 *
 * Admin queries for /admin/organizations: paginated list with member
 * counts, profile lookup, and full membership history per organization.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { organizations, organizationMemberships, people, users } from "@gc-stats/db";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike, qualifiedColumn } from "@/lib/db-search";

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

const memberCountSql = sql<number>`(
  SELECT COUNT(*) FROM ${organizationMemberships} om
  WHERE om.organization_id = ${qualifiedColumn(organizations, "id")} AND om.period @> CURRENT_DATE
)`;

export const ORGANIZATIONS_PAGE_SIZE = 30;

export async function listAdminOrganizations(opts: { q: string; sort: OrganizationSort; direction: SortDirection; page: number }): Promise<{ rows: AdminOrganizationRow[]; total: number }> {
  const { q, sort, direction, page } = opts;
  const conditions = [];

  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(organizations.name, v), foldedIlike(organizations.slug, v)]);
    if (numeric) clauses.push(eq(organizations.id, Number(q)));
    conditions.push(or(...clauses));
  }

  const sortCol = sort === "members" ? memberCountSql : organizations.name;
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
        memberCount: memberCountSql,
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
  tags: string[];
  countryCode: string | null;
  secondaryCountryCode: string | null;
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
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    countryCode: row.countryCode,
    secondaryCountryCode: row.secondaryCountryCode,
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
export async function getAdminOrganizationMembers(organizationId: number): Promise<AdminOrganizationMember[]> {
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
