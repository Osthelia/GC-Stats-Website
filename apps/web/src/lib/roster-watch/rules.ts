/**
 * GC-Stats - rules
 *
 * Pre-filter of tweets: never_exclude keywords go to the LLM, matching exclusion rules skip it (rules.json).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import rulesJson from "./rules.json";

export type RuleMedia = "photo" | "video";
/** maxWords: the tweet must have at most that many words (links, mentions and hashtags excluded), alone it is the whole condition. */
export type ExcludeRule = { id: string; anyKeywords?: string[]; regex?: string; requiresMedia?: RuleMedia; maxWords?: number };
export type OtherGames = { anyKeywords: string[]; caseSensitiveKeywords: string[] };
export type RulesConfig = { otherGames?: OtherGames; neverExclude: { anyKeywords: string[] }; exclude: ExcludeRule[] };

export const OTHER_GAME_RULE_ID = "other_game";

export type RuleInput = { text: string; mediaTypes: RuleMedia[] };
export type RuleDecision = { excluded: false } | { excluded: true; ruleId: string };

export const DEFAULT_RULES = rulesJson as RulesConfig;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole word match, so "ace" does not match "place" and "bench" does not match "benchmark". */
function keywordRegex(keyword: string): RegExp {
  const body = escapeRegex(keyword.trim());
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, "iu");
}

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keywordRegex(keyword).test(text));
}

/** Abbreviations like "LoL" must keep their case, otherwise the slang "lol" would match. */
function matchesExactCase(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(keyword)}(?![\\p{L}\\p{N}_])`, "u").test(text));
}

function mentionsOtherGame(text: string, games: OtherGames | undefined): boolean {
  return !!games && (matchesAnyKeyword(text, games.anyKeywords) || matchesExactCase(text, games.caseSensitiveKeywords));
}

const regexCache = new Map<string, RegExp | null>();

/** Compiled once per pattern, null for an invalid one so a bad rule never fails the whole run. */
export function compileRuleRegex(pattern: string): RegExp | null {
  if (regexCache.has(pattern)) return regexCache.get(pattern) ?? null;
  let compiled: RegExp | null = null;
  try {
    compiled = new RegExp(pattern, "iu");
  } catch (error) {
    console.error("[roster-watch] invalid rule regex (%s)", pattern, error);
  }
  regexCache.set(pattern, compiled);
  return compiled;
}

/** Words made of letters or digits, so emojis, links, mentions and hashtags do not count. */
export function countWords(text: string): number {
  return text
    .replace(/https?:\/\/\S+|[@#][\p{L}\p{N}_]+/gu, " ")
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

function ruleMatches(rule: ExcludeRule, input: RuleInput): boolean {
  if (rule.requiresMedia && !input.mediaTypes.includes(rule.requiresMedia)) return false;
  if (rule.maxWords !== undefined) {
    if (countWords(input.text) > rule.maxWords) return false;
    if (!rule.anyKeywords && !rule.regex) return true;
  }
  if (rule.anyKeywords && matchesAnyKeyword(input.text, rule.anyKeywords)) return true;
  if (rule.regex && compileRuleRegex(rule.regex)?.test(input.text)) return true;
  return false;
}

/** A game other than Valorant wins over everything (orgs announce rosters for many games), then never_exclude, then the first matching exclusion rule, otherwise the tweet goes to the LLM. */
export function applyRules(input: RuleInput, rules: RulesConfig = DEFAULT_RULES): RuleDecision {
  if (mentionsOtherGame(input.text, rules.otherGames)) return { excluded: true, ruleId: OTHER_GAME_RULE_ID };
  if (matchesAnyKeyword(input.text, rules.neverExclude.anyKeywords)) return { excluded: false };
  const rule = rules.exclude.find((candidate) => ruleMatches(candidate, input));
  return rule ? { excluded: true, ruleId: rule.id } : { excluded: false };
}
