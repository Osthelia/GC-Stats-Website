/**
 * GC-Stats - pick-rate-list
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { AgentIcon } from "@/components/match/agent-icon";
import { GOLD } from "@/lib/theme-colors";
import type { TournamentMapPickRate } from "@/lib/tournament-maps-data";

/**
 * Agent pick-rate bar list — shared by the per-map and tournament-wide pick
 * rate panels on the maps page. `initialLimit` (used for the tournament-wide
 * one, explicit user request) caps the list to its top N entries behind a
 * show more/less toggle instead of always rendering the full agent roster.
 */
export function PickRateList({
  rates,
  emptyLabel,
  initialLimit,
  showMoreLabel,
  showLessLabel,
}: {
  rates: TournamentMapPickRate[];
  emptyLabel: string;
  initialLimit?: number;
  showMoreLabel?: string;
  showLessLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (rates.length === 0) return <p className="text-sm text-neutral-500">{emptyLabel}</p>;

  const collapsible = !!initialLimit && rates.length > initialLimit;
  const visible = collapsible && !expanded ? rates.slice(0, initialLimit) : rates;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-neutral-800 p-3" style={{ background: "var(--gcs-surface-2)" }}>
      {visible.map((pr) => (
        <div key={pr.agent} className="flex items-center gap-2.5">
          <AgentIcon agent={pr.agent} size="h-6 w-6" />
          <span className="w-24 flex-none truncate text-xs font-semibold text-neutral-200">{pr.agent}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full" style={{ width: `${pr.pickPct ?? 0}%`, background: GOLD }} />
          </div>
          <span className="w-10 flex-none text-right font-mono text-[11px] tabular-nums text-neutral-400">{pr.pickPct ?? 0}%</span>
        </div>
      ))}

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 self-start rounded-md px-2 py-1 font-mono text-[10px] font-bold tracking-wide text-[#e4ae22] uppercase transition-colors hover:bg-white/5"
        >
          {expanded ? showLessLabel : showMoreLabel}
        </button>
      )}
    </div>
  );
}
