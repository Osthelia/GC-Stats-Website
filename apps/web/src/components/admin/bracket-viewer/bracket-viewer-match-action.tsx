/**
 * GC-Stats - bracket-viewer-match-action
 *
 * Lets a bracket viewer page replace the "open the match" link of its nodes
 * and rows by its own click action (the Liquipedia import opens a modal), and
 * color them by status.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { createContext, useContext } from "react";
import type { LiquipediaImportStatus } from "@/lib/liquipedia-import-status-types";

export type BracketViewerMatchTarget = { id: number; teamA: string | null; teamB: string | null };

type MatchAction = {
  statuses: Record<number, LiquipediaImportStatus>;
  onSelect: (match: BracketViewerMatchTarget) => void;
};

const MatchActionContext = createContext<MatchAction | null>(null);

export const BracketViewerMatchActionProvider = MatchActionContext.Provider;

/** Null on the plain viewer, where matches link to their admin page. */
export function useBracketViewerMatchAction(): MatchAction | null {
  return useContext(MatchActionContext);
}
