/**
 * GC-Stats - ghost
 *
 * Ghost profiles (opponents of a GC team in an uncovered mix tournament)
 * show up in match payloads, but have no profile of their own: fetching one
 * by id answers with an explicit error instead of a bare "Not found".
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ApiV1Error } from "./handler";

const MESSAGES = {
  team: "Non-GC team: it only appears as a GC team's opponent in an uncovered tournament and has no profile.",
  player: "Non-GC player: they only appear in a GC team's match in an uncovered tournament and have no profile.",
  tournament: "Uncovered tournament: only the GC teams' matches played in it are available, through the matches endpoints.",
} as const;

export function rejectGhost(row: { isGhost: boolean } | undefined, kind: keyof typeof MESSAGES): void {
  if (row?.isGhost) throw new ApiV1Error(404, MESSAGES[kind]);
}
