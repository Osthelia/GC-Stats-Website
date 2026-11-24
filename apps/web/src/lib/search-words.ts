/**
 * GC-Stats - search-words
 *
 * Matching for the searches that filter options already loaded in the browser: every word of the search must appear
 * somewhere in the label, in any order, ignoring case and accents. "babylon gaming" finds "Barcząca Babylon vs Nova
 * Gaming" without typing the "vs" between the names. Anything a plain substring search found is still found.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

// Letters Unicode does not split into a base letter and an accent.
const FOLDED: Record<string, string> = { ł: "l", đ: "d", ø: "o", æ: "ae", œ: "oe", ß: "ss", ı: "i", þ: "th", ð: "d" };

/** Lowercase, without accents: "Barcząca Łódź" → "barczaca lodz". */
export function foldForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[łđøæœßıþð]/g, (c) => FOLDED[c] ?? c);
}

/** The words of a search, folded; empty when the search is blank. */
export function searchWords(query: string): string[] {
  return foldForSearch(query).split(/\s+/).filter(Boolean);
}

/** Whether a label holds every word of the search (an empty search matches everything). */
export function matchesSearchWords(label: string, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const folded = foldForSearch(label);
  return words.every((word) => folded.includes(word));
}
