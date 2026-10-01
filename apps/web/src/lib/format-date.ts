/**
 * GC-Stats - format-date
 *
 * Legal pages show a "last updated" date fixed to the deploy date, not
 * per-render.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export function formatLastUpdated(locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}
