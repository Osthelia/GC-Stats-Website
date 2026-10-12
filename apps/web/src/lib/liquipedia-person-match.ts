/**
 * GC-Stats - liquipedia-person-match
 *
 * Reads the people of a Liquipedia participants block and pairs them with
 * GC Stats people. Pure, no DB access (runs client side on the admin page).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { extractAllTemplates, opponentTemplateName, parseTemplateParams, parseTemplatePositional } from "@/lib/wikicode-import";
import { diceSimilarity, normalizeTeamName, type MatchConfidence } from "@/lib/liquipedia-team-match";

export type PersonMatchCandidate = {
  personId: number;
  /** Handle, aliases and real name. */
  names: string[];
};

export type PersonMatchSuggestion = {
  personId: number;
  liquipediaName: string;
  confidence: MatchConfidence;
  score: number;
};

/** "jade (German player)" gives "jade": the disambiguation suffix is not part of the name. */
function withoutDisambiguation(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "");
}

/** `{{Person|id|link=Page}}` names: the page when the id is disambiguated, else the id. Deduped. */
export function parsePersonNames(wikicode: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const template of extractAllTemplates(wikicode, "Person")) {
    const name = parseTemplateParams(template)["link"]?.trim() || parseTemplatePositional(template)[0]?.trim() || "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

export type PersonEntry = {
  name: string;
  /** Team page name of the enclosing `{{Opponent}}`, null outside of one. */
  team: string | null;
  /** True for a `role=` other than a player one (coach, manager, ...). */
  isStaff: boolean;
};

/** Same people as `parsePersonNames`, with the team block they sit in and whether they are staff. */
export function parsePersonEntries(wikicode: string): PersonEntry[] {
  const seen = new Set<string>();
  const entries: PersonEntry[] = [];
  const read = (block: string, team: string | null) => {
    for (const template of extractAllTemplates(block, "Person")) {
      const name = parseTemplateParams(template)["link"]?.trim() || parseTemplatePositional(template)[0]?.trim() || "";
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      entries.push({ name, team, isStaff: !!parseTemplateParams(template)["role"]?.trim() });
    }
  };
  for (const opponent of extractAllTemplates(wikicode, "Opponent")) read(opponent, opponentTemplateName(opponent));
  // People written outside of any Opponent block
  read(wikicode, null);
  return entries;
}

function comparePersonNames(personName: string, liquipediaName: string): { confidence: MatchConfidence; score: number } | null {
  const a = normalizeTeamName(personName).replaceAll(" ", "");
  const b = normalizeTeamName(withoutDisambiguation(liquipediaName)).replaceAll(" ", "");
  if (a.length < 2 || b.length < 2) return null;
  if (a === b) return { confidence: "exact", score: 100 };
  const dice = diceSimilarity(a, b);
  if (dice >= 0.85) return { confidence: "confident", score: Math.round(dice * 100) };
  if (dice >= 0.7) return { confidence: "possible", score: Math.round(dice * 100) };
  return null;
}

/** Best one to one pairing between people and Liquipedia names, highest scores first. */
export function suggestPersonMatches(people: PersonMatchCandidate[], liquipediaNames: string[]): PersonMatchSuggestion[] {
  const pairs: PersonMatchSuggestion[] = [];
  for (const person of people) {
    for (const liquipediaName of liquipediaNames) {
      let best: { confidence: MatchConfidence; score: number } | null = null;
      for (const name of person.names) {
        const result = comparePersonNames(name, liquipediaName);
        if (result && (!best || result.score > best.score)) best = result;
      }
      if (best) pairs.push({ personId: person.personId, liquipediaName, ...best });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  const usedPeople = new Set<number>();
  const usedNames = new Set<string>();
  const result: PersonMatchSuggestion[] = [];
  for (const pair of pairs) {
    const key = pair.liquipediaName.toLowerCase();
    if (usedPeople.has(pair.personId) || usedNames.has(key)) continue;
    usedPeople.add(pair.personId);
    usedNames.add(key);
    result.push(pair);
  }
  return result;
}
