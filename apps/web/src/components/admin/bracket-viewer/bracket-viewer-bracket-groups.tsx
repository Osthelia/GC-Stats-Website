/**
 * GC-Stats - bracket-viewer-bracket-groups
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BracketViewerCanvas } from "@/components/admin/bracket-viewer/bracket-viewer-canvas";
import type { BracketContainerGroup } from "@/lib/bracket-group-containers";
import type { PublicStageContainer } from "@/lib/tournament-bracket-data";

/**
 * Switches between a stage's independent physical brackets (e.g. Group A-H,
 * each its own double-elim) — mirrors BracketViewerStandingsTabs' tab
 * pattern, but for bracket canvases instead of a standings table. Only
 * rendered when `groupBracketContainers` finds more than one group; a
 * single group keeps using a plain BracketViewerCanvas directly (see
 * BracketViewerPanel). See `lib/bracket-group-containers.ts` for why groups
 * are detected by container name rather than bracket_edges connectivity.
 */
export function BracketViewerBracketGroups({ tournamentId, groups, tbdLabel }: { tournamentId: number; groups: BracketContainerGroup<PublicStageContainer>[]; tbdLabel: string }) {
  const [activeKey, setActiveKey] = useState(groups[0]!.key);
  const active = groups.find((g) => g.key === activeKey) ?? groups[0]!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActiveKey(g.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.97]",
              g.key === activeKey ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <BracketViewerCanvas key={active.key} tournamentId={tournamentId} containers={active.containers} tbdLabel={tbdLabel} />
    </div>
  );
}
