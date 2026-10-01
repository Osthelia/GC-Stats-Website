/**
 * GC-Stats - liquipedia-team-match
 *
 * Matches Liquipedia participant names against GC Stats teams, with a
 * confidence level per suggestion. Pure, no DB access (runs client side on
 * the admin Liquipedia page).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { extractAllTemplates, opponentTemplateName, parseTemplatePositional } from "@/lib/wikicode-import";

export type MatchConfidence = "exact" | "confident" | "possible";

export type TeamMatchCandidate = {
  teamId: number;
  /** Every name the team is known under (current, short, entrant snapshot, history). */
  names: string[];
};

export type TeamMatchSuggestion = {
  teamId: number;
  liquipediaName: string;
  confidence: MatchConfidence;
  score: number;
};

// Qualifiers that commonly differ between a GC roster name and its Liquipedia page ("FENNEL GC" / "FENNEL Female").
const QUALIFIER_TOKENS = new Set(["gc", "female", "fe", "women", "womens", "ladies", "girls", "team", "esports", "esport", "gaming", "club", "academy"]);

export function normalizeTeamName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function coreTokens(normalized: string): string[] {
  return normalized.split(" ").filter((token) => token.length > 0 && !QUALIFIER_TOKENS.has(token));
}

function bigrams(value: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < value.length - 1; i++) result.push(value.slice(i, i + 2));
  return result;
}

/** Sørensen-Dice coefficient on character bigrams, 0..1. */
function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const counts = new Map<string, number>();
  for (const gram of bigrams(a)) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  let overlap = 0;
  for (const gram of bigrams(b)) {
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      overlap++;
      counts.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

/** Compares one team name with one Liquipedia name, null when unrelated. */
export function compareTeamNames(teamName: string, liquipediaName: string): { confidence: MatchConfidence; score: number } | null {
  const a = normalizeTeamName(teamName);
  const b = normalizeTeamName(liquipediaName);
  if (!a || !b) return null;
  if (a.replaceAll(" ", "") === b.replaceAll(" ", "")) return { confidence: "exact", score: 100 };

  const coreA = coreTokens(a);
  const coreB = coreTokens(b);
  const compactCoreA = coreA.join("");
  const compactCoreB = coreB.join("");
  const dice = diceSimilarity(a.replaceAll(" ", ""), b.replaceAll(" ", ""));

  // Same name once GC qualifiers are dropped: "FENNEL GC" / "FENNEL Female".
  if (compactCoreA.length >= 2 && compactCoreA === compactCoreB) return { confidence: "confident", score: 95 };
  if (dice >= 0.85) return { confidence: "confident", score: Math.round(dice * 100) };

  // One core name fully contained in the other: "Shopify Rebellion" / "Shopify Rebellion Gold".
  const setA = new Set(coreA);
  const setB = new Set(coreB);
  const shared = coreA.filter((token) => setB.has(token));
  const smaller = Math.min(setA.size, setB.size);
  if (smaller > 0 && shared.length === smaller && shared.join("").length >= 3) {
    return { confidence: "confident", score: Math.max(85, Math.round(dice * 100)) };
  }

  if (shared.some((token) => token.length >= 3) || dice >= 0.6) {
    return { confidence: "possible", score: Math.max(50, Math.min(84, Math.round(dice * 100))) };
  }
  return null;
}

/** Opponent names listed in a `{{TeamParticipants}}` block (contenders included), deduped, TBD dropped. */
export function parseParticipantNames(wikicode: string): string[] {
  const names: string[] = [];
  for (const template of extractAllTemplates(wikicode, "Opponent")) {
    const name = opponentTemplateName(template);
    if (name) names.push(name);
  }
  for (const template of extractAllTemplates(wikicode, "TeamOpponent")) {
    const name = opponentTemplateName(template);
    if (name) names.push(name);
  }
  for (const template of extractAllTemplates(wikicode, "Contenders")) {
    for (const name of parseTemplatePositional(template)) {
      if (name && name.toLowerCase() !== "tbd") names.push(name);
    }
  }
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Best one to one pairing between teams and Liquipedia names, highest scores first. */
export function suggestTeamMatches(teams: TeamMatchCandidate[], liquipediaNames: string[]): TeamMatchSuggestion[] {
  const pairs: TeamMatchSuggestion[] = [];
  for (const team of teams) {
    for (const liquipediaName of liquipediaNames) {
      let best: { confidence: MatchConfidence; score: number } | null = null;
      for (const name of team.names) {
        const result = compareTeamNames(name, liquipediaName);
        if (result && (!best || result.score > best.score)) best = result;
      }
      if (best) pairs.push({ teamId: team.teamId, liquipediaName, ...best });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  const usedTeams = new Set<number>();
  const usedNames = new Set<string>();
  const result: TeamMatchSuggestion[] = [];
  for (const pair of pairs) {
    const key = pair.liquipediaName.toLowerCase();
    if (usedTeams.has(pair.teamId) || usedNames.has(key)) continue;
    usedTeams.add(pair.teamId);
    usedNames.add(key);
    result.push(pair);
  }
  return result;
}
