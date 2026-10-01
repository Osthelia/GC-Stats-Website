/**
 * GC-Stats - user-reports-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportStatusBadge } from "@/components/admin/report-status-badge";
import type { AdminUserReportReceivedRow, AdminUserReportSubmittedRow } from "@/lib/admin-user-detail";

/** Mirrors V1's admin user detail "reports" card (received and submitted side by side). */
export async function UserReportsPanel({ received, submitted }: { received: AdminUserReportReceivedRow[]; submitted: AdminUserReportSubmittedRow[] }) {
  const t = await getTranslations("admin.users.reportsPanel");

  return (
    <Card className="sm:col-span-2">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("received")}</p>
          {received.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyReceived")}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {received.map((r) => (
                <Link key={r.id} href="/admin/reports" className="flex items-center justify-between gap-3 rounded px-1 py-2 text-sm hover:bg-muted/50">
                  <div className="min-w-0">
                    <span>{r.category}</span>
                    <span className="ml-2 truncate text-muted-foreground">{r.reason}</span>
                  </div>
                  <ReportStatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("submitted")}</p>
          {submitted.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptySubmitted")}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {submitted.map((r) => (
                <Link key={r.id} href="/admin/reports" className="flex items-center justify-between gap-3 rounded px-1 py-2 text-sm hover:bg-muted/50">
                  <div className="min-w-0">
                    <span className="truncate">{r.reportedUsername ?? "-"}</span>
                    <span className="ml-2 truncate text-muted-foreground">{r.category}</span>
                  </div>
                  <ReportStatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
