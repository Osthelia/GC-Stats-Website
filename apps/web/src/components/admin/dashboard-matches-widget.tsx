/**
 * GC-Stats - dashboard-matches-widget
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminEntityLogo } from "@/components/admin/admin-entity-logo";
import type { DashboardMatchRow } from "@/lib/admin-dashboard";

/** Same widget as V1's admin dashboard "matches_widget" — live matches then soonest upcoming. */
export async function DashboardMatchesWidget({ matches }: { matches: DashboardMatchRow[] }) {
  const t = await getTranslations("admin.dashboard.matchesWidget");

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{t("title")}</h2>
      </div>

      {matches.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <div>
          {matches.map((match) => (
            <Link key={match.id} href={`/admin/tournaments/${match.tournamentId}/matches/${match.id}`} className="block border-b px-4 py-3 transition-colors last:border-0 hover:bg-muted/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <AdminEntityLogo src={match.aLogoUrl} alt="" sizeClassName="size-5" />
                  <span className="truncate text-xs font-bold">{match.aName}</span>
                </div>
                <span className="shrink-0 px-1 text-xs font-black text-muted-foreground">
                  {match.scoreA != null && match.scoreB != null ? `${match.scoreA} - ${match.scoreB}` : t("vs")}
                </span>
                <div className="flex min-w-0 items-center justify-end gap-1.5">
                  <span className="truncate text-right text-xs font-bold">{match.bName}</span>
                  <AdminEntityLogo src={match.bLogoUrl} alt="" sizeClassName="size-5" />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase ${match.status === "live" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"}`}
                >
                  {match.status === "live" ? t("statusLive") : t("statusPending")}
                </span>
                <span className="text-[10px] text-muted-foreground">{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : "-"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
