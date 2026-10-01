/**
 * GC-Stats - dashboard-modifications-widget
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminEntityLogo } from "@/components/admin/admin-entity-logo";
import type { DashboardModificationRow } from "@/lib/admin-dashboard";

/**
 * Same widget as V1's dashboard-modifications-widget.blade.php — one partial
 * shared between team and player, only the model/route/lang strings differ.
 * See getDashboardModifications for why this is sparser than V1's version
 * (no automatic per-save activity logging in V2 yet).
 */
export async function DashboardModificationsWidget({ type, rows }: { type: "team" | "player"; rows: DashboardModificationRow[] }) {
  const t = await getTranslations(`admin.dashboard.${type === "team" ? "teamModificationsWidget" : "playerModificationsWidget"}`);
  const tCauser = await getTranslations("admin.dashboard");

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{t("title")}</h2>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <div>
          {rows.map((row) => {
            const href = row.subjectId != null ? `/admin/${type === "team" ? "teams" : "players"}/${row.subjectId}` : null;
            const content = (
              <>
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <AdminEntityLogo src={row.subjectLogoUrl} alt="" sizeClassName="size-5" />
                    <span className="truncate text-xs font-bold">{row.subjectName ?? t("deletedSubject")}</span>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate rounded-md bg-amber-400/10 px-2 py-0.5 text-[9px] font-black tracking-widest text-amber-500 uppercase">{row.event ?? "-"}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{row.causerUsername ?? tCauser("causerSystem")}</span>
                </div>
              </>
            );
            return href ? (
              <Link key={row.id} href={href} className="block border-b px-4 py-3 transition-colors last:border-0 hover:bg-muted/50">
                {content}
              </Link>
            ) : (
              <div key={row.id} className="block border-b px-4 py-3 last:border-0">
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
