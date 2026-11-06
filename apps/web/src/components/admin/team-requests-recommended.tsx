/**
 * GC-Stats - team-requests-recommended
 *
 * Recommended tab, two columns: the request being prepared on the large left
 * side, the choice of team on the right (recommended teams, or any team
 * through the picker).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { AdminEntityLogo } from "@/components/admin/admin-entity-logo";
import { TeamPicker } from "@/components/admin/team-picker";
import { TeamRequestBuilder } from "@/components/admin/team-request-builder";
import { searchRequestTeams } from "@/actions/admin-team-requests";
import type { RecommendedTeamRow } from "@/lib/admin-team-requests";

export function TeamRequestsRecommended({ rows, canManage }: { rows: RecommendedTeamRow[]; canManage: boolean }) {
  const t = useTranslations("admin.teamRequests.recommended");
  const format = useFormatter();
  const [teamId, setTeamId] = useState<number | null>(null);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        {teamId !== null ? (
          <TeamRequestBuilder key={teamId} teamId={teamId} onDone={() => setTeamId(null)} />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-20 text-center">
            <MousePointerClick className="size-8 text-muted-foreground" />
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
        {canManage && (
          <div className="flex flex-col gap-1.5">
            <Label>{t("pickTeam")}</Label>
            <TeamPicker
              value={null}
              onChange={(team) => team && setTeamId(team.id)}
              placeholder={t("pickPlaceholder")}
              searchPlaceholder={t("searchPlaceholder")}
              noResultsLabel={t("noResults")}
              search={searchRequestTeams}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t("listTitle", { count: rows.length })}</h2>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto pr-1">
              {rows.map((row) => (
                <li key={row.teamId}>
                  <button
                    type="button"
                    disabled={!canManage}
                    aria-pressed={teamId === row.teamId}
                    onClick={() => setTeamId(row.teamId)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:bg-muted enabled:active:scale-[0.98]",
                      teamId === row.teamId && "border-primary bg-primary/10"
                    )}
                  >
                    <AdminEntityLogo src={row.teamLogoUrl} alt={row.teamName} sizeClassName="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{row.teamName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.lastTournamentName} · {format.dateTime(new Date(row.lastPlayedAt), { dateStyle: "medium" })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
