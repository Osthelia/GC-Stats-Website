/**
 * GC-Stats — 01-organizations
 *
 * V1 to V2 migration step: migrates organizations, point types, and news
 * publishers into their V2 tables, tracking legacy id mappings for later
 * migration steps to resolve foreign keys against.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db, v1 } from "./connection";
import { getMappedId, setMappedId } from "./id-map";
import { organizations, pointTypes } from "../../src/schema";
import { convertCountryCode } from "./country-code";
import { convertSocials } from "./social-links";

// mysql2 auto-parses MySQL JSON-typed columns into JS values already —
// longtext columns storing JSON (Laravel's `json` cast on a TEXT column)
// come back as strings instead. Handle both.
function parseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === "object") return val as T;
  try { return JSON.parse(val as string); } catch { return fallback; }
}

interface V1Organization {
  id: number;
  name: string;
  slug: string;
  // Live schema disagrees with database/migrations/0110_create_organization_table.php
  // (singular `type` string there) — checked live: `type` singular, is what
  // actually exists. `types` (plural, JSON array) kept as a fallback in case
  // a differently-migrated V1 database has it instead. SELECT * (below)
  // rather than naming columns, so this never hard-fails on either shape.
  type?: string | null;
  types?: string | null; // JSON array, if present instead of `type`
  country_code: string | null;
  socials: string; // JSON object
  max_permissions: string | null;
}

interface V1PointType {
  id: number;
  name: string;
  label: string;
  start_date: string;
  end_date: string;
}

interface V1NewsPublisher {
  id: number;
  name: string;
  slug: string;
  socials: string; // JSON object: twitter/discord/instagram/youtube/website
  max_permissions: string | null;
}

export async function migrateOrganizations() {
  // SELECT * rather than naming columns — `type` vs `types` disagrees with
  // the tracked migration (see V1Organization above), and SELECT * never
  // hard-fails on a column that turns out not to exist.
  const [rows] = await v1.query<any[]>("SELECT * FROM organization");
  let created = 0, skipped = 0;
  for (const row of rows as V1Organization[]) {
    if (await getMappedId("organization", row.id)) { skipped++; continue; }
    const tags = row.types != null ? parseJson<string[]>(row.types, []) : row.type ? [row.type] : [];
    const [inserted] = await db.insert(organizations).values({
      name: row.name,
      slug: row.slug,
      tags,
      countryCode: convertCountryCode(row.country_code),
      socials: convertSocials(parseJson(row.socials, {})),
      maxPermissions: row.max_permissions ? parseJson(row.max_permissions, null) : null,
    }).returning({ id: organizations.id });
    await setMappedId("organization", row.id, inserted.id);
    created++;
  }
  console.log(`organizations: ${created} created, ${skipped} already migrated`);
}

// V1 keeps publishers as their own `news_publishers` table (Laravel model
// NewsPublisher), with no FK to `organization` — but V2 merged the concept,
// organizations double as publishers (see schema/content.ts). A publisher
// whose slug matches an already-migrated organization is treated as the
// same real-world entity (the common case: most GC-Stats publishers ARE the
// org), anything left over becomes its own organization (tag 'media') so no
// historical news/stream/vod attribution is lost. Must run after
// migrateOrganizations, before any phase resolving "news_publisher".
export async function migrateNewsPublishers() {
  const [rows] = await v1.query<any[]>("SELECT id, name, slug, socials, max_permissions FROM news_publishers");
  let matched = 0, created = 0, skipped = 0;
  for (const row of rows as V1NewsPublisher[]) {
    if (await getMappedId("news_publisher", row.id)) { skipped++; continue; }
    const [existingOrg] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, row.slug));
    if (existingOrg) {
      await setMappedId("news_publisher", row.id, existingOrg.id);
      matched++;
      continue;
    }
    const [inserted] = await db.insert(organizations).values({
      name: row.name,
      slug: row.slug,
      tags: ["media"],
      socials: convertSocials(parseJson(row.socials, {})),
      maxPermissions: row.max_permissions ? parseJson(row.max_permissions, null) : null,
    }).returning({ id: organizations.id });
    await setMappedId("news_publisher", row.id, inserted.id);
    created++;
  }
  console.log(`news_publishers: ${matched} matched to existing organizations, ${created} created as new organizations, ${skipped} already migrated`);
}

export async function migratePointTypes() {
  const [rows] = await v1.query<any[]>("SELECT id, name, label, start_date, end_date FROM point_types");
  let created = 0, skipped = 0;
  for (const row of rows as V1PointType[]) {
    if (await getMappedId("point_type", row.id)) { skipped++; continue; }
    const [inserted] = await db.insert(pointTypes).values({
      name: row.name,
      label: row.label,
      startDate: row.start_date,
      endDate: row.end_date,
    }).returning({ id: pointTypes.id });
    await setMappedId("point_type", row.id, inserted.id);
    created++;
  }
  console.log(`point_types: ${created} created, ${skipped} already migrated`);
}
