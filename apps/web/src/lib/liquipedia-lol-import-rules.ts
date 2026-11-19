/**
 * GC-Stats - liquipedia-lol-import-rules
 *
 * The priority rules of the League match wikicode import. The wikicode is the
 * lowest-priority source: it only fills what is empty and never overwrites
 * Riot or Leaguepedia data, anything entered by hand or an earlier wikicode
 * import. Pure, so the rules can be tested without a database.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type GameField = "winner" | "duration";

/** What the import needs to know about a game that already exists. */
export type ExistingGameState = {
  winnerEntrantId: number | null;
  durationSeconds: number | null;
  source: string | null;
  draftEditedAt: Date | null;
  hasDraftRows: boolean;
  hasTeamStats: boolean;
};

export type GameFieldPlan = {
  /** Columns to write: all the wikicode has for a new game, only the empty ones for an existing game. */
  values: { winnerEntrantId?: number; isCompleted?: boolean; durationSeconds?: number };
  filled: GameField[];
  /** The game has another value than the wikicode: reported, not changed. */
  differs: GameField[];
};

/** The winner and length of a game. `existing` is null when the game doesn't exist yet. */
export function planGameFields(existing: Pick<ExistingGameState, "winnerEntrantId" | "durationSeconds"> | null, wiki: { winnerEntrantId: number | null; lengthSeconds: number | null }): GameFieldPlan {
  const plan: GameFieldPlan = { values: {}, filled: [], differs: [] };
  if (wiki.winnerEntrantId !== null) {
    if (!existing || existing.winnerEntrantId === null) {
      plan.values.winnerEntrantId = wiki.winnerEntrantId;
      plan.values.isCompleted = true;
      plan.filled.push("winner");
    } else if (existing.winnerEntrantId !== wiki.winnerEntrantId) {
      plan.differs.push("winner");
    }
  }
  if (wiki.lengthSeconds !== null) {
    if (!existing || existing.durationSeconds === null) {
      plan.values.durationSeconds = wiki.lengthSeconds;
      plan.filled.push("duration");
    } else if (existing.durationSeconds !== wiki.lengthSeconds) {
      plan.differs.push("duration");
    }
  }
  return plan;
}

export type DraftBlock = "editedByHand" | "leaguepediaData" | "riotData" | "existingDraft";

/** Why the wikicode may not write the draft of an existing game, null when it may. The first reason that applies wins. */
export function draftBlockedBy(existing: Pick<ExistingGameState, "source" | "draftEditedAt" | "hasDraftRows" | "hasTeamStats">): DraftBlock | null {
  if (existing.draftEditedAt !== null) return "editedByHand";
  if (existing.source === "leaguepedia") return "leaguepediaData";
  if (existing.source !== null || existing.hasTeamStats) return "riotData";
  if (existing.hasDraftRows) return "existingDraft";
  return null;
}
