/**
 * GC-Stats - liquipedia-name-validation
 *
 * Shared by the server actions and the admin forms (no DB import).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type LiquipediaNameError = "required" | "tooLong" | "invalidChars";

export const LIQUIPEDIA_NAME_MAX = 200;

/** Characters that would break the generated wikicode or a Liquipedia page title. */
const FORBIDDEN = /[|{}[\]<>#\n\r]/;

export function validateLiquipediaName(name: string): LiquipediaNameError | null {
  if (!name) return "required";
  if (name.length > LIQUIPEDIA_NAME_MAX) return "tooLong";
  if (FORBIDDEN.test(name)) return "invalidChars";
  return null;
}
