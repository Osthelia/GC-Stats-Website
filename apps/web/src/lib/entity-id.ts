/**
 * GC-Stats - entity-id
 *
 * Every entity URL carries a cosmetic slug for sharing/SEO as a separate
 * path segment from the numeric id, e.g. `/tournaments/123/vct-masters`,
 * `/team/45/team-liquid`, `/player/6/handle`, `/organization/2/gc-stats`.
 * The slug is never validated against the entity's real name: only the
 * numeric id resolves the page, so a stale or wrong slug in a shared link
 * still works instead of 404ing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export function parseEntityId(param: string): number | null {
  const match = /^(\d+)/.exec(param);
  return match ? Number(match[1]) : null;
}

/** Cosmetic-only slug from a display name — never validated on read, see above. `fallback` is used only when the name has no ASCII letters/digits at all (e.g. an emoji-only name). */
export function slugify(name: string, fallback = "team"): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}
