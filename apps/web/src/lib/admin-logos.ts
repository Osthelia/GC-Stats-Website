/**
 * GC-Stats - admin-logos
 *
 * Resolves an entity's logo history and picks which one is live: current
 * or as of a past date, plain or per site theme, single or batched. Used
 * by both the admin logo manager and public-site logo rendering.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { logos } from "@gc-stats/db";
import { logoUrl } from "@gc-stats/storage";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";

export type LogoEntityType = "team" | "person" | "organization" | "news-author" | "tournament";

export type AdminLogoEntry = {
  id: string;
  since: string | null;
  until: string | null;
  isOngoing: boolean;
  theme: string | null;
  isVisible: boolean;
  url: string | null;
  thumbnailUrl: string | null;
};

/**
 * `logos` is polymorphic and its `id` (uuid) is the same uuid used as the
 * storage folder (see packages/storage/src/logos.ts) — no `url` column on
 * the row itself, the URL is always rebuilt from entityType+id by
 * convention (mirrors V1's LogoUploadService, which does the same).
 */
export async function getEntityLogos(entityType: LogoEntityType, entityId: number): Promise<AdminLogoEntry[]> {
  const rows = await db
    .select({ id: logos.id, period: logos.period, theme: logos.theme, isVisible: logos.isVisible })
    .from(logos)
    .where(and(eq(logos.entityType, entityType), eq(logos.entityId, entityId)))
    .orderBy(desc(logos.period));

  return rows.map((r) => ({
    id: r.id,
    // `period` is a tstzrange (unlike the daterange columns elsewhere) —
    // its bounds round-trip with a time/offset ("2026-08-26 00:00:00+00"),
    // but admins only ever pick a date, so only the date part is shown.
    since: rangeLower(r.period)?.slice(0, 10) ?? null,
    until: rangeUpper(r.period)?.slice(0, 10) ?? null,
    isOngoing: rangeIsOpen(r.period),
    theme: r.theme,
    isVisible: r.isVisible,
    url: logoUrl(entityType, r.id, "full"),
    thumbnailUrl: logoUrl(entityType, r.id, "200x200"),
  }));
}

// Team and player logos are near-square and shown at 84px max, so the 200x200
// thumbnail is enough. Other types keep the full file (often wide, the thumbnail is cropped).
const THUMBNAIL_ENTITY_TYPES: ReadonlySet<LogoEntityType> = new Set(["team", "person"]);

/** Image to render on the site for this entry: the 200x200 thumbnail for teams/players, the full file otherwise. */
export function displayLogoUrl(entry: AdminLogoEntry | null, entityType: LogoEntityType): string | null {
  if (!entry) return null;
  return THUMBNAIL_ENTITY_TYPES.has(entityType) ? entry.thumbnailUrl : entry.url;
}

/** The row currently in effect (open period, visible) — what should render as the entity's live logo. */
export function currentLogo(entries: AdminLogoEntry[], theme?: string | null): AdminLogoEntry | null {
  const candidates = entries.filter((e) => e.isOngoing && e.isVisible);
  const themed = theme ? candidates.find((e) => e.theme === theme) : undefined;
  return themed ?? candidates.find((e) => !e.theme) ?? candidates[0] ?? null;
}

function periodContainsDate(since: string | null, until: string | null, at: string): boolean {
  if (since && at < since) return false;
  if (until && at >= until) return false;
  return true;
}

/**
 * The row in effect on a past date ("YYYY-MM-DD") — what a historical match/team/player
 * page should render instead of the live logo. Falls back to `currentLogo` when no row
 * covers that date, or when the covering row has been masked by an admin (`isVisible: false`).
 */
export function logoAt(entries: AdminLogoEntry[], atDate: string, theme?: string | null): AdminLogoEntry | null {
  const candidates = entries.filter((e) => periodContainsDate(e.since, e.until, atDate) && e.isVisible);
  const themed = theme ? candidates.find((e) => e.theme === theme) : undefined;
  return (themed ?? candidates.find((e) => !e.theme) ?? candidates[0]) ?? currentLogo(entries, theme);
}

/**
 * Live logo URL per entity, batched — thin wrapper around
 * `getEntityLogosBatch`/`currentLogo` for the common case (a list of matches,
 * roster members, etc. that just need "the current logo URL or null" per id,
 * not the full history of logo rows). Picks a logo without regard for the
 * visitor's site theme — fine for admin/dashboard (always the same shadcn
 * theme) but never for the public site, which must vary the logo with the
 * viewer's dark/light choice — see `themedLogoUrls`/`getCurrentLogoUrlsThemed`.
 */
export async function getCurrentLogoUrls(entityType: LogoEntityType, entityIds: number[]): Promise<Map<number, string | null>> {
  const batch = await getEntityLogosBatch(entityType, entityIds);
  const map = new Map<number, string | null>();
  for (const id of entityIds) map.set(id, displayLogoUrl(currentLogo(batch.get(id) ?? []), entityType));
  return map;
}

/** A logo resolved for both site themes — see lib/site-settings.tsx's `SiteTheme`. */
export type ThemedLogoUrls = { dark: string | null; light: string | null };

/**
 * Same `themed ?? untheme'd ?? first` resolution as `currentLogo`, but for
 * both themes at once — what every public-site logo render needs so the
 * image can flip with the visitor's site theme (CSS-only swap, see
 * components/site/themed-logo-image.tsx) instead of showing one arbitrary
 * variant regardless of theme.
 */
export function themedLogoUrls(entries: AdminLogoEntry[], entityType: LogoEntityType): ThemedLogoUrls {
  return { dark: displayLogoUrl(currentLogo(entries, "dark"), entityType), light: displayLogoUrl(currentLogo(entries, "light"), entityType) };
}

/** Same as `themedLogoUrls`, resolved as of a past date instead of "now" — see `logoAt`. */
export function themedLogoUrlsAt(entries: AdminLogoEntry[], entityType: LogoEntityType, atDate: string): ThemedLogoUrls {
  return { dark: displayLogoUrl(logoAt(entries, atDate, "dark"), entityType), light: displayLogoUrl(logoAt(entries, atDate, "light"), entityType) };
}

/** Batched `themedLogoUrls` — the public-site counterpart to `getCurrentLogoUrls`. */
export async function getCurrentLogoUrlsThemed(entityType: LogoEntityType, entityIds: number[]): Promise<Map<number, ThemedLogoUrls>> {
  const batch = await getEntityLogosBatch(entityType, entityIds);
  const map = new Map<number, ThemedLogoUrls>();
  for (const id of entityIds) map.set(id, themedLogoUrls(batch.get(id) ?? [], entityType));
  return map;
}

/**
 * Same as getEntityLogos, but for many entities of the same type in one
 * query — used by the global search, which needs a live logo per candidate
 * (up to a few dozen rows across teams/people/organizations) without an
 * N+1 round-trip per candidate.
 */
export async function getEntityLogosBatch(entityType: LogoEntityType, entityIds: number[]): Promise<Map<number, AdminLogoEntry[]>> {
  const map = new Map<number, AdminLogoEntry[]>();
  if (entityIds.length === 0) return map;

  const rows = await db
    .select({ id: logos.id, entityId: logos.entityId, period: logos.period, theme: logos.theme, isVisible: logos.isVisible })
    .from(logos)
    .where(and(eq(logos.entityType, entityType), inArray(logos.entityId, entityIds)))
    .orderBy(desc(logos.period));

  for (const r of rows) {
    const entry: AdminLogoEntry = {
      id: r.id,
      since: rangeLower(r.period)?.slice(0, 10) ?? null,
      until: rangeUpper(r.period)?.slice(0, 10) ?? null,
      isOngoing: rangeIsOpen(r.period),
      theme: r.theme,
      isVisible: r.isVisible,
      url: logoUrl(entityType, r.id, "full"),
      thumbnailUrl: logoUrl(entityType, r.id, "200x200"),
    };
    const list = map.get(r.entityId);
    if (list) list.push(entry);
    else map.set(r.entityId, [entry]);
  }

  return map;
}
