/**
 * GC-Stats - roster-source
 *
 * Source of a roster arrival or departure: a link to the announcement, or a
 * plain text option. Stored as text, converted to a Liquipedia reference only
 * when transfers are generated.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { isValidUrl } from "@/lib/admin-validation";

export const ROSTER_SOURCE_MAX_LENGTH = 500;

export const ROSTER_SOURCE_TEXTS = {
  startedTournament: "Started playing at a tournament",
  stoppedTournament: "Stopped playing at a tournament",
  insideSource: "Inside source",
  declaredByPlayer: "Declared by the player",
} as const;

export type RosterSourceTextKey = keyof typeof ROSTER_SOURCE_TEXTS;
export type RosterSourceKind = "join" | "left";

/** Text options offered for each side. The player declaration is set by the system, never picked. */
export const ROSTER_SOURCE_PRESETS: Record<RosterSourceKind, readonly RosterSourceTextKey[]> = {
  join: ["startedTournament", "insideSource"],
  left: ["stoppedTournament", "insideSource"],
};

export type RosterSourceError = "invalidUrl" | "sourceTooLong" | "invalidSource";

/** Key of the text option a stored value is, null for a link or an empty value. */
export function rosterSourceTextKey(value: string | null | undefined): RosterSourceTextKey | null {
  const trimmed = value?.trim();
  return (Object.keys(ROSTER_SOURCE_TEXTS) as RosterSourceTextKey[]).find((key) => ROSTER_SOURCE_TEXTS[key] === trimmed) ?? null;
}

/**
 * Error code for a source, null when it is empty (no source), a link or an option of its side.
 * `allowSelfDeclared` accepts the player declaration, which only the system and admins can set.
 */
export function validateRosterSource(value: string | null | undefined, kind: RosterSourceKind, options: { allowSelfDeclared?: boolean } = {}): RosterSourceError | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const textKey = rosterSourceTextKey(trimmed);
  if (textKey) {
    const allowed = ROSTER_SOURCE_PRESETS[kind].includes(textKey) || (textKey === "declaredByPlayer" && options.allowSelfDeclared);
    return allowed ? null : "invalidSource";
  }
  if (trimmed.length > ROSTER_SOURCE_MAX_LENGTH) return "sourceTooLong";
  return isValidUrl(trimmed) ? null : "invalidUrl";
}

/** Value to store: trimmed, null when empty. */
export function normalizeRosterSource(value: string | null | undefined): string | null {
  return value?.trim() || null;
}
