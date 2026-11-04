/**
 * GC-Stats - map-players-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { AgentIcon } from "@/components/match/agent-icon";
import type { AdminMapPlayerStatRow, AdminPreviousLineupPlayer } from "@/lib/admin-matches";

type PlayerRow = Pick<AdminMapPlayerStatRow, "personId" | "handle" | "valName"> & { agentName?: string | null };

function TeamPlayers({
  teamName,
  rows,
  previousLineup,
  labels,
}: {
  teamName: string;
  rows: PlayerRow[];
  previousLineup: AdminPreviousLineupPlayer[];
  labels: { player: string; ign: string; agent: string; empty: string; previousLineup: string };
}) {
  const isPrevious = rows.length === 0 && previousLineup.length > 0;
  if (isPrevious) rows = previousLineup;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h4 className="truncate text-center text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{teamName}</h4>
      {isPrevious && <p className="text-center text-[10px] text-muted-foreground italic">{labels.previousLineup}</p>}
      {rows.length === 0 ? (
        <p className="py-1 text-center text-[11px] text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-x-2 gap-y-1">
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">{labels.player}</span>
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">{labels.ign}</span>
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">{labels.agent}</span>
          {rows.map((row, i) => (
            <div key={`${row.personId ?? "x"}-${i}`} className="contents">
              <span className="truncate border-t pt-1 text-xs font-semibold">{row.handle ?? "-"}</span>
              <span className="truncate border-t pt-1 text-xs" title={row.valName ?? undefined}>
                {row.valName ?? "-"}
              </span>
              <span className="flex items-center gap-1.5 border-t pt-1 text-xs text-muted-foreground">
                {row.agentName ? <AgentIcon agent={row.agentName} size="h-4 w-4" /> : null}
                {row.agentName ?? "-"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export async function MapPlayersPanel({
  entrantAId,
  entrantBId,
  entrantAName,
  entrantBName,
  stats,
  previousLineupA,
  previousLineupB,
}: {
  entrantAId: number;
  entrantBId: number;
  entrantAName: string;
  entrantBName: string;
  stats: AdminMapPlayerStatRow[];
  previousLineupA: AdminPreviousLineupPlayer[];
  previousLineupB: AdminPreviousLineupPlayer[];
}) {
  const t = await getTranslations("admin.tournaments.matches.maps");
  const labels = { player: t("columnPlayer"), ign: t("columnIgn"), agent: t("columnAgent"), empty: t("noPlayerData"), previousLineup: t("previousLineupNote") };

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <TeamPlayers teamName={entrantAName} rows={stats.filter((s) => s.entrantId === entrantAId)} previousLineup={previousLineupA} labels={labels} />
      <TeamPlayers teamName={entrantBName} rows={stats.filter((s) => s.entrantId === entrantBId)} previousLineup={previousLineupB} labels={labels} />
    </div>
  );
}
