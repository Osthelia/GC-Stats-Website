/**
 * GC-Stats - bracket-match-action
 *
 * Lets a page that shows the public bracket replace the "open the match" link
 * of its nodes and rows by its own click action (the Liquipedia export opens a modal).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { createContext, useContext } from "react";

export type BracketMatchTarget = { id: number; teamA: string | null; teamB: string | null };

type MatchAction = { onSelect: (match: BracketMatchTarget) => void };

const MatchActionContext = createContext<MatchAction | null>(null);

export const BracketMatchActionProvider = MatchActionContext.Provider;

/** Null on the regular tournament page, where matches link to their page. */
export function useBracketMatchAction(): MatchAction | null {
  return useContext(MatchActionContext);
}
