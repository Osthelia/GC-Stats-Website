/**
 * GC-Stats - news-languages-default
 *
 * A viewer's default news languages when they haven't customized the filter:
 * the site's own locale plus English, deduplicated. Split out of
 * news-languages.ts (which pulls in the db client) so client components can
 * import this pure formula without bundling server code.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { AppLocale } from "@/i18n/routing";

/**
 * A viewer's default news languages when they haven't customized the filter
 * (the site's own locale plus English, 2026-09-13 session, explicit: "par
 * défaut en anglais & dans la langue du site"). Deduplicated so an
 * English-locale viewer just gets ["en"]. Split out of `news-languages.ts`
 * (which pulls in the db client) so client components — the header's
 * settings panel — can import this pure formula without bundling server code.
 */
export function defaultNewsLanguages(locale: AppLocale): string[] {
  return [...new Set([locale, "en"])];
}
