/**
 * GC-Stats - tournament-container-tabs
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type ReactNode } from "react";
import { GOLD } from "@/lib/home-fake-data";

export type TournamentContainerTab = {
  id: number;
  name: string;
  /** Pre-rendered by the server parent (standings table or "not started" placeholder) — this component only switches which one is visible. */
  content: ReactNode;
};

/**
 * Tabbed navigation across a stage's non-bracket containers (standings
 * groups, or a container with no matches yet). Bracket-shaped containers
 * of a single physical bracket never appear here — they stay merged into
 * one canvas (TournamentBracketCanvas, upper/lower/GF drawn as connected
 * lanes). When a stage holds SEVERAL independent physical brackets (e.g.
 * Group A-H each with their own double-elim), TournamentOverview reuses
 * this same tab component to switch between them — see
 * `lib/bracket-group-containers.ts`.
 *
 * With exactly one container (the common case — a stage with a single
 * Swiss/round-robin group), this renders NOTHING but that container's own
 * content: no pill, no card, no status badge, no match count (explicit user
 * request, 2026-09-13: "y'a tjr un container inutile autour du swiss/robin,
 * avec écris 'En attente' & le nbr de match, on le dégage") — V1 never wraps
 * its standings table in extra chrome either (`swiss-standings.blade.php`
 * is just the table + legend, no status/count anywhere around it). A stage
 * with 2+ containers still needs the pill row to switch between them, kept
 * bare (no card, no status/count) for the same reason.
 */
/**
 * Uncontrolled by default (own `useState`, every pre-existing call site).
 * Pass `activeId`/`onActiveIdChange` to lift the selection to a parent
 * instead — e.g. the pick'em stage board, which needs to know which scoring
 * scope tab is active to annotate the bracket with it, not just switch
 * which panel is visible.
 */
export function TournamentContainerTabs({ tabs, activeId: controlledActiveId, onActiveIdChange }: { tabs: TournamentContainerTab[]; activeId?: number; onActiveIdChange?: (id: number) => void }) {
  const [internalActiveId, setInternalActiveId] = useState(tabs[0]!.id);
  const activeId = controlledActiveId ?? internalActiveId;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]!;

  function selectTab(id: number) {
    if (onActiveIdChange) onActiveIdChange(id);
    else setInternalActiveId(id);
  }

  if (tabs.length === 1) {
    return <>{active.content}</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const on = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] transition-all duration-200 active:scale-[0.96] ${on ? "" : "hover:-translate-y-0.5 hover:bg-white/[0.06]"}`}
              style={on ? { background: GOLD, color: "#0b0b0c", fontWeight: 700 } : { background: "var(--gcs-surface-3)", color: "var(--gcs-text-secondary)", fontWeight: 600, border: "1px solid #262626" }}
            >
              {tab.name}
            </button>
          );
        })}
      </div>

      <div key={active.id} className="animate-in fade-in-0 duration-200">
        {active.content}
      </div>
    </div>
  );
}
