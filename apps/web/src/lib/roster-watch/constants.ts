/**
 * GC-Stats - constants
 *
 * Shared enums of the roster watch (verdicts, topics, statuses) and their invariants.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const VERDICTS = ["roster", "not_roster", "unsure"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const ROSTER_TOPICS = ["roster_join", "roster_leave", "roster_bench", "staff_change"] as const;
export const NON_ROSTER_TOPICS = ["match_promo", "match_result", "highlight", "sponsor", "merch", "giveaway", "stream", "content", "community"] as const;
export const TOPICS = [...ROSTER_TOPICS, "tryouts", ...NON_ROSTER_TOPICS, "other"] as const;
export type Topic = (typeof TOPICS)[number];

/** Topics an admin can pick when a tweet is not about the roster, "not_enough_info" is for tweets too vague to be sorted. */
export const REVIEW_TOPICS = ["not_enough_info", "wrong_game", "match_promo", "match_result", "highlight", "sponsor", "merch", "giveaway", "content", "other"] as const;
export type ReviewTopic = (typeof REVIEW_TOPICS)[number];

export const STAGES = ["excluded", "classified", "error"] as const;
export type Stage = (typeof STAGES)[number];

export const SIGNAL_STATUSES = ["pending", "team_edited", "ignored", "marked_not_roster", "reported_missed"] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

/** Period filters (days) of the admin list, kept here so client components do not import the DB queries. */
export const ROSTER_WATCH_PERIODS = ["7", "30", "90"] as const;

export const REVIEW_NOTE_MAX_LENGTH = 1000;
export const X_HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

/** Enforces the topic/verdict consistency regardless of what the model answered. */
export function enforceInvariants(verdict: Verdict, topic: Topic): Verdict {
  if ((ROSTER_TOPICS as readonly string[]).includes(topic)) return "roster";
  if (topic === "other" || topic === "tryouts") return "unsure";
  const nonRosterTopic = (NON_ROSTER_TOPICS as readonly string[]).includes(topic);
  if (verdict === "not_roster" && !nonRosterTopic) return "unsure";
  if (verdict === "roster" && nonRosterTopic) return "unsure";
  return verdict;
}
