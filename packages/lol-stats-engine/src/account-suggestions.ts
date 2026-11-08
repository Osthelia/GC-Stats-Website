/**
 * GC-Stats — account-suggestions module
 *
 * Who a Riot account most likely belongs to: the people of the team on its side, ranked by how close their handle is to
 * the Riot name and by the lane they play. Pure, so the ranking can be tested on its own.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export interface SuggestionCandidate {
  id: number;
  handle: string;
  aliases: string[];
  /** The lanes the person plays: saved on their roster entries, or taken from their games. */
  lanes: readonly string[];
}

/** A shared lane counts for a quarter of a perfect name match: a hint to order close names, not a reason to suggest. */
const LANE_BONUS = 0.25;
/** Shorter names would match inside almost anything. */
const MIN_CONTAINED_LENGTH = 3;

function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function bigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
}

/** Sørensen–Dice similarity of the bigrams, 0 to 1. */
function diceSimilarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const left = bigrams(a);
  const right = bigrams(b);
  let shared = 0;
  for (const [pair, count] of left) shared += Math.min(count, right.get(pair) ?? 0);
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

/**
 * How close a handle is to a Riot name, 0 to 1: 1 when they are the same, 0.9 when one holds the other (a Riot name is
 * often the team tag plus the handle, "SLYA Pivotless"), else the bigram similarity.
 */
export function nameCloseness(handle: string, riotName: string): number {
  const a = normalizeName(handle);
  const b = normalizeName(riotName);
  if (a === "" || b === "") return 0;
  if (a === b) return 1;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= MIN_CONTAINED_LENGTH && longer.includes(shorter)) return 0.9;
  return diceSimilarity(a, b);
}

/**
 * The candidates best first: the closest of their handle and aliases to the Riot name, plus a bonus when they play the
 * lane the account played. Equal scores keep the handle order. A candidate with no resemblance and no lane still comes
 * last rather than being dropped, since a roster of five is short enough to show whole.
 */
export function rankSuggestions(riotName: string, lane: string | null, candidates: readonly SuggestionCandidate[], limit = 5): SuggestionCandidate[] {
  return candidates
    .map((candidate) => {
      const closeness = Math.max(...[candidate.handle, ...candidate.aliases].map((name) => nameCloseness(name, riotName)));
      return { candidate, score: closeness + (lane !== null && candidate.lanes.includes(lane) ? LANE_BONUS : 0) };
    })
    .sort((x, y) => y.score - x.score || x.candidate.handle.localeCompare(y.candidate.handle))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
