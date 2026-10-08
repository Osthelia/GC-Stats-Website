/**
 * GC-Stats - dashboard-tournaments-widget
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { REGIONS, normalizeRegion } from "@/lib/tournament-regions";
import { cn } from "@/lib/utils";
import type { DashboardPage, DashboardTournamentRow, DashboardTournamentTab } from "@/lib/admin-dashboard";

const TABS: DashboardTournamentTab[] = ["live", "upcoming", "inactive"];

/** Same 3-tab widget as V1's admin dashboard (live/upcoming/inactive tournaments), tab and page kept in the URL. */
export async function DashboardTournamentsWidget({ tab, data, query }: { tab: DashboardTournamentTab; data: DashboardPage<DashboardTournamentRow>; query: Record<string, string> }) {
  const t = await getTranslations("admin.dashboard.tournamentsWidget");
  const { tournamentPage: _page, tournamentTab: _tab, ...otherQuery } = query;

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        {TABS.map((key) => (
          <Link
            key={key}
            href={{ pathname: "/admin", query: { ...otherQuery, tournamentTab: key } }}
            className={cn("text-[11px] font-bold tracking-widest uppercase transition-colors active:scale-95", tab === key ? "text-amber-400" : "text-muted-foreground hover:text-foreground")}
          >
            {t(key)}
          </Link>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <div>
          {data.rows.map((tournament) => {
            const region = REGIONS[normalizeRegion(tournament.region)];
            return (
              <Link key={tournament.id} href={`/admin/tournaments/${tournament.id}`} className="block border-b px-4 py-3 transition-colors last:border-0 hover:bg-muted/50">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold">{tournament.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", tournament.active ? "bg-emerald-500" : "bg-destructive")} />
                    <span className="text-[10px] text-muted-foreground">{tournament.startDate}</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="inline-block rounded-md px-2 py-0.5 text-[9px] font-black tracking-widest uppercase" style={{ color: region.color, background: `${region.color}15` }}>
                    {tournament.region ?? region.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <AdminPagination
        pathname="/admin"
        pageParam="tournamentPage"
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        query={{ ...otherQuery, tournamentTab: tab }}
        label={`${data.total}`}
        className="border-t px-4 py-2"
      />
    </div>
  );
}
