/**
 * GC-Stats - organization-search
 *
 * Typo-tolerant organization search backing the OrganizationPicker
 * component, same shape as user-search.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizations } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export type OrganizationPickerResult = { id: number; name: string; slug: string };

/** Typo-tolerant organization search backing OrganizationPicker, same shape as user-search.ts::searchUsersQuery. */
export async function searchOrganizationsQuery(query: string): Promise<OrganizationPickerResult[]> {
  const q = query.trim();
  if (!q) {
    return db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug }).from(organizations).orderBy(organizations.name).limit(8);
  }

  const variants = typoVariants(q.toLowerCase());
  const clauses = variants.flatMap((v) => [foldedIlike(organizations.name, v), foldedIlike(organizations.slug, v)]);

  return db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(or(...clauses))
    .orderBy(organizations.name)
    .limit(8);
}
