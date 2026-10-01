/**
 * GC-Stats - bracket-editor-validation
 *
 * Wraps the shared bracket engine's graph validation for the admin visual
 * editor: filters out "unfed slot" errors, since the editor allows a
 * deliberate TBD slot that the engine's generator output never would.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { validateGraph, type BracketGraph, type ValidationResult } from "@gc-stats/bracket-engine";

// The shared engine treats an unfed slot as an "orphan" — correct for a
// generator's output (which must always be fully resolved), but not for the
// visual editor: an admin can deliberately leave a slot as TBD (no entrant,
// no bye, no incoming edge) to fill in later from the match edit page. The
// editor's own notion of "valid enough to save" filters that specific error
// out while keeping every other structural check (duplicate feed, unknown
// match id, cycle) — those still block saving, an orphan slot doesn't.
const ORPHAN_ERROR = /^match .+ has an unfed slot "(a|b)" \(orphan\)$/;

export function validateEditorGraph(graph: BracketGraph): ValidationResult {
  const result = validateGraph(graph);
  const errors = result.errors.filter((e) => !ORPHAN_ERROR.test(e));
  return { valid: errors.length === 0, errors };
}
