/**
 * GC-Stats - admin-validation
 *
 * Shared field validation for /admin server actions: URLs wherever a form
 * takes one, and the field lengths more than one place checks.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
/** The longest patch a match can hold: the match form and the League wikicode import both check it. */
export const PATCH_MAX_LENGTH = 20;

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
