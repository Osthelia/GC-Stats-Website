/**
 * GC-Stats - liquipedia-import-viewer
 *
 * Wraps the bracket viewer of the Liquipedia Match Import page: matches are
 * colored by import status and open the import modal when clicked.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BracketViewerMatchActionProvider, type BracketViewerMatchTarget } from "@/components/admin/bracket-viewer/bracket-viewer-match-action";
import { LiquipediaMatchImportDialog } from "@/components/admin/liquipedia-match-import-dialog";
import { IMPORT_STATUS_DOT_CLASS, type LiquipediaImportStatus } from "@/lib/liquipedia-import-status-types";
import { cn } from "@/lib/utils";

const LEGEND: LiquipediaImportStatus[] = ["none", "partial", "done"];

export function LiquipediaImportViewer({ tournamentId, statuses, children }: { tournamentId: number; statuses: Record<number, LiquipediaImportStatus>; children: ReactNode }) {
  const t = useTranslations("admin.tournaments.liquipediaImportPage");
  const [selected, setSelected] = useState<BracketViewerMatchTarget | null>(null);

  return (
    <BracketViewerMatchActionProvider value={{ statuses, onSelect: setSelected }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {LEGEND.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", IMPORT_STATUS_DOT_CLASS[status])} />
            {t(`legend.${status}`)}
          </span>
        ))}
      </div>
      {children}
      <LiquipediaMatchImportDialog tournamentId={tournamentId} match={selected} onClose={() => setSelected(null)} />
    </BracketViewerMatchActionProvider>
  );
}
