/**
 * GC-Stats - tournament-stages-overview
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { stageContainerStatusBadgeClass, tournamentActiveBadgeClass } from "@/lib/status-colors";
import type { AdminStageRow } from "@/lib/admin-tournament-detail";

/**
 * Read-only mirror of V1's admin tournament show "Phases" panel
 * (Website/resources/views/admin/tournaments/show.blade.php) — a compact
 * tree of stages/containers with status + match count, linking into the
 * full bracket management page rather than duplicating its CRUD here.
 */
export async function TournamentStagesOverview({ tournamentId, stages }: { tournamentId: number; stages: AdminStageRow[] }) {
  const t = await getTranslations("admin.tournaments.stages");
  const tPage = await getTranslations("admin.tournaments");

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t("heading")}</h2>
        <Link href={`/admin/tournaments/${tournamentId}/bracket-editor`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          {tPage("bracketManagementButton")}
        </Link>
      </div>

      {stages.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}

      <div className="flex flex-col gap-4">
        {stages.map((stage) => (
          <div key={stage.id} className="relative border-l pl-4 last:pb-0">
            <span className="absolute top-1 -left-[3.5px] h-[7px] w-[7px] rounded-full bg-primary" />
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{stage.name}</h3>
              <Badge className={stageContainerStatusBadgeClass(stage.status)}>{t(`stageStatus.${stage.status}`)}</Badge>
              <Badge className={tournamentActiveBadgeClass(stage.active)}>{t(stage.active ? "activateButton" : "deactivateButton")}</Badge>
            </div>
            {stage.containers.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">{t("noContainers")}</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {stage.containers.map((container) => (
                  <div key={container.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5">
                    <span className="truncate text-xs font-medium">{container.name}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge className={stageContainerStatusBadgeClass(container.status)}>{t(`containerStatus.${container.status}`)}</Badge>
                      <span className="text-[11px] text-muted-foreground">{t("matchCount", { count: container.matchCount })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
