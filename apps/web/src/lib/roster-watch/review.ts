/**
 * GC-Stats - review
 *
 * Validation and status transitions of a reviewed signal. Pure, the server
 * action only loads the signal and writes the resulting patch.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { REVIEW_NOTE_MAX_LENGTH, REVIEW_TOPICS, X_HANDLE_RE, type ReviewTopic, type SignalStatus, type Stage, type Verdict } from "./constants";

export type ReviewInput =
  | { action: "team_edited" }
  | { action: "ignored" }
  | { action: "marked_not_roster"; reviewTopic: string; reviewNote: string }
  | { action: "reported_missed"; reviewNote: string };

export type ReviewableSignal = { stage: Stage; verdict: Verdict | null; status: SignalStatus };

export type ReviewPatch = { status: SignalStatus; reviewTopic: ReviewTopic | null; reviewNote: string | null };

export type ReviewError = "invalidState" | "invalidTopic" | "noteRequired" | "noteTooLong";
export type ReviewPlan = { ok: true; patch: ReviewPatch } | { ok: false; error: ReviewError; field?: "reviewTopic" | "reviewNote" };

/** Roster and unsure tweets can be edited or ignored, only unsure ones can be declared not roster, only audit tweets can be reported missed. */
export function planReview(signal: ReviewableSignal, input: ReviewInput): ReviewPlan {
  if (signal.status !== "pending") return { ok: false, error: "invalidState" };

  const inAudit = signal.verdict === "not_roster" || signal.stage === "excluded" || signal.stage === "error";
  const rawTopic: unknown = (input as { reviewTopic?: unknown }).reviewTopic;
  const rawNote: unknown = (input as { reviewNote?: unknown }).reviewNote;
  const note = typeof rawNote === "string" ? rawNote.trim() : "";

  switch (input.action) {
    case "team_edited":
    case "ignored": {
      if (signal.verdict !== "roster" && signal.verdict !== "unsure") return { ok: false, error: "invalidState" };
      return { ok: true, patch: { status: input.action, reviewTopic: null, reviewNote: null } };
    }
    case "marked_not_roster": {
      if (signal.verdict !== "unsure") return { ok: false, error: "invalidState" };
      if (!(REVIEW_TOPICS as readonly unknown[]).includes(rawTopic)) return { ok: false, error: "invalidTopic", field: "reviewTopic" };
      if (!note) return { ok: false, error: "noteRequired", field: "reviewNote" };
      if (note.length > REVIEW_NOTE_MAX_LENGTH) return { ok: false, error: "noteTooLong", field: "reviewNote" };
      return { ok: true, patch: { status: "marked_not_roster", reviewTopic: rawTopic as ReviewTopic, reviewNote: note } };
    }
    case "reported_missed": {
      if (!inAudit) return { ok: false, error: "invalidState" };
      if (note.length > REVIEW_NOTE_MAX_LENGTH) return { ok: false, error: "noteTooLong", field: "reviewNote" };
      return { ok: true, patch: { status: "reported_missed", reviewTopic: null, reviewNote: note || null } };
    }
    default:
      return { ok: false, error: "invalidState" };
  }
}

/** x.com paths that look like a profile URL but are not one. */
const RESERVED_X_ROUTES = new Set(["home", "i", "intent", "search", "explore", "settings", "notifications", "messages", "share", "hashtag", "login", "signup", "compose", "tos", "privacy"]);

export type HandleResult = { ok: true; handle: string } | { ok: false; error: "handleRequired" | "handleInvalid" };

/** Accepts "@handle", "handle" or an x.com / twitter.com profile URL. */
export function normalizeXHandle(input: unknown): HandleResult {
  if (typeof input !== "string") return { ok: false, error: "handleRequired" };
  let value = input.trim();
  if (!value) return { ok: false, error: "handleRequired" };
  const url = value.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/?#]+)/i);
  if (url?.[1]) value = url[1];
  value = value.replace(/^@/, "");
  if (!X_HANDLE_RE.test(value) || RESERVED_X_ROUTES.has(value.toLowerCase())) return { ok: false, error: "handleInvalid" };
  return { ok: true, handle: value.toLowerCase() };
}
