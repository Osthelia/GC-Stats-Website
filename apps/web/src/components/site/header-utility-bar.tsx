/**
 * GC-Stats - header-utility-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";

/**
 * Top-right utility slot for entity header cards (tournament/match/player/
 * team) — "Admin panel" and "Suggest an edit" both live here instead of
 * being mixed into the identity/socials block, per explicit user direction.
 * The header card itself must be `relative` for this to position correctly.
 */
export function HeaderUtilityBar({ children }: { children: ReactNode }) {
  return <div className="absolute right-4 top-4 z-10 flex flex-wrap items-center justify-end gap-2">{children}</div>;
}
