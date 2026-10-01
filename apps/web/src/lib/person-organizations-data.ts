/**
 * GC-Stats - person-organizations-data
 *
 * Builds the public "organizations" tab on a player profile: fetches
 * organization memberships for a person and splits them into current
 * (open period) and former (closed period) entries with resolved logos.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { desc, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizationMemberships, organizations } from "@gc-stats/db";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";

export type PersonOrganization = {
  membershipId: number;
  organizationId: number;
  name: string;
  slug: string;
  tags: string[];
  role: string;
  since: string | null;
  until: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

/** Mirrors `getOrganizationMembers` (organization-page-data.ts), pivoted by person instead of by organization — the public "which organizations is this person part of" panel/tab on the player profile. */
export async function getPersonOrganizations(personId: number): Promise<{ current: PersonOrganization[]; formers: PersonOrganization[] }> {
  const rows = await db
    .select({
      membershipId: organizationMemberships.id,
      organizationId: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      tags: organizations.tags,
      role: organizationMemberships.role,
      period: organizationMemberships.period,
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(eq(organizationMemberships.personId, personId))
    .orderBy(desc(organizationMemberships.id));

  const logosByOrgId = await getCurrentLogoUrlsThemed("organization", [...new Set(rows.map((r) => r.organizationId))]);

  const current: PersonOrganization[] = [];
  const formers: PersonOrganization[] = [];

  for (const r of rows) {
    const entry: PersonOrganization = {
      membershipId: r.membershipId,
      organizationId: r.organizationId,
      name: r.name,
      slug: r.slug,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      role: r.role,
      since: rangeLower(r.period),
      until: rangeUpper(r.period),
      logoUrl: logosByOrgId.get(r.organizationId)?.dark ?? null,
      logoUrlLight: logosByOrgId.get(r.organizationId)?.light ?? null,
    };
    if (rangeIsOpen(r.period)) current.push(entry);
    else formers.push(entry);
  }

  formers.sort((a, b) => (b.until ?? "").localeCompare(a.until ?? ""));

  return { current, formers };
}
