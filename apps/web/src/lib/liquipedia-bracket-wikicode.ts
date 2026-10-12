/**
 * GC-Stats - liquipedia-bracket-wikicode
 *
 * Reads the bracket templates (`Bracket/8U4L2DSL1D`) out of pasted Liquipedia
 * wikicode, and validates one. Shared by the server actions and the admin
 * forms (no DB import).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { LIQUIPEDIA_NAME_MAX, type LiquipediaNameError } from "@/lib/liquipedia-name-validation";

export type BracketTemplateError = LiquipediaNameError | "invalidFormat";

export type BracketEntry = {
  template: string;
  /** Value of `matchsection=`, usually the stage name. */
  matchSection: string | null;
};

const TEMPLATE_FORMAT = /^Bracket\/[^|{}[\]<>#\n\r]+$/;

/** `{{Bracket|Bracket/8U4L2DSL1D|id=...|matchsection=Playoffs ...`, one entry per bracket of the wikicode. */
export function parseBracketEntries(wikicode: string): BracketEntry[] {
  const entries: BracketEntry[] = [];
  const starts = [...wikicode.matchAll(/\{\{\s*Bracket\s*\|\s*(Bracket\/[^|}\n\r]+?)\s*(?=[|}\n\r])/gi)];
  starts.forEach((start, index) => {
    const body = wikicode.slice(start.index + start[0].length, starts[index + 1]?.index ?? wikicode.length);
    const section = body.match(/\|\s*matchsection\s*=\s*([^|\n\r}]*)/i)?.[1]?.trim();
    entries.push({ template: start[1]!.trim(), matchSection: section || null });
  });
  return entries;
}

export function validateBracketTemplate(template: string): BracketTemplateError | null {
  if (!template) return "required";
  if (template.length > LIQUIPEDIA_NAME_MAX) return "tooLong";
  if (!template.startsWith("Bracket/")) return "invalidFormat";
  return TEMPLATE_FORMAT.test(template) ? null : "invalidChars";
}
