/**
 * GC-Stats - bracket-viewer-group-matches
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BracketViewerMatchList } from "@/components/admin/bracket-viewer/bracket-viewer-match-list";
import type { PublicStageContainer } from "@/lib/tournament-bracket-data";

/**
 * Group containers (Swiss, round-robin) of a stage, switched via tabs when
 * there's more than one — same tab pattern as the rest of the bracket
 * viewer, but rendering ONLY the conventional match list, never a standings
 * table or the bracket canvas. Explicit user request (2026-09-14): a
 * standings+match-list version was tried and rejected ("Dégage completement
 * l'affichage robin/swiss"), then match-list-only was confirmed as the
 * actual ask ("Je t'ai dit de mettre UNIQUEMENT la liste des matchs").
 */
export function BracketViewerGroupMatches({ tournamentId, containers }: { tournamentId: number; containers: PublicStageContainer[] }) {
  const [activeId, setActiveId] = useState(containers[0]!.id);
  const active = containers.find((c) => c.id === activeId) ?? containers[0]!;

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      {containers.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {containers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.97]",
                c.id === activeId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : (
        <h2 className="text-[13.5px] font-bold tracking-tight">{active.name}</h2>
      )}

      <BracketViewerMatchList tournamentId={tournamentId} matches={active.matches ?? []} />
    </div>
  );
}
