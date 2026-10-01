/**
 * GC-Stats - search-typo
 *
 * Typo-tolerant search term expansion, ported from V1's
 * App\Services\SearchService (stripAccents/typoVariants). Used to widen
 * admin list searches so "Zennit" also matches "Zénnit" (accents) and
 * "Atlas" also matches "Atttlas" (doubled letters), same substitutions as
 * the public search: i to y, c to k, ph to f, z to s, and single/double
 * letter pairs.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const ACCENTS: Record<string, string> = {
  à: "a", â: "a", ä: "a", á: "a", ã: "a", å: "a",
  è: "e", ê: "e", ë: "e", é: "e",
  ì: "i", î: "i", ï: "i", í: "i",
  ò: "o", ô: "o", ö: "o", ó: "o", õ: "o", ø: "o",
  ù: "u", û: "u", ü: "u", ú: "u",
  ý: "y", ÿ: "y", ç: "c", ñ: "n", ß: "ss",
};

export function stripAccents(value: string): string {
  return value.replace(/[àâäáãåèêëéìîïíòôöóõøùûüúýÿçñß]/g, (c) => ACCENTS[c] ?? c);
}

/** Drops everything but letters/digits — lets "remake" find "Re//make" or "G2 Gozen" find "g2gozen". Search-matching only, never used for display. */
export function stripSpecialChars(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const DOUBLE_LETTERS = ["tt", "ll", "ss", "rr", "nn", "pp"];

/** Returns the accent-stripped term plus typo-corrected variants (deduped, term always first). */
export function typoVariants(term: string): string[] {
  const base = stripAccents(term);
  const variants = new Set<string>([base]);

  if (base.includes("i")) variants.add(base.replaceAll("i", "y"));
  if (base.includes("y")) variants.add(base.replaceAll("y", "i"));
  if (base.includes("c")) variants.add(base.replaceAll("c", "k"));
  if (base.includes("k")) variants.add(base.replaceAll("k", "c"));
  if (base.includes("ph")) variants.add(base.replaceAll("ph", "f"));
  if (base.includes("f")) variants.add(base.replaceAll("f", "ph"));
  if (base.includes("z")) variants.add(base.replaceAll("z", "s"));
  if (base.includes("s")) variants.add(base.replaceAll("s", "z"));

  for (const double of DOUBLE_LETTERS) {
    if (base.includes(double)) variants.add(base.replaceAll(double, double.charAt(0)));
  }

  return [...variants];
}
