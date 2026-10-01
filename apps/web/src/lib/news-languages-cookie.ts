/**
 * GC-Stats - news-languages-cookie
 *
 * The news language preference (`useSiteSettings().newsLanguages`) is also
 * mirrored into this cookie so the server can honor it on the very first
 * render of `/news`, `localStorage` alone can't be read during SSR, which
 * would otherwise flash the default languages on every full page load until
 * client JS corrects the URL.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const NEWS_LANGUAGES_COOKIE = "gcs-news-languages";

export function parseNewsLanguagesCookie(raw: string | undefined | null): string[] | null {
  if (!raw) return null;
  const languages = raw.split(",").filter(Boolean);
  return languages.length > 0 ? languages : null;
}
