/**
 * GC-Stats - user-sanctions-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SanctionTypeBadge } from "@/components/admin/sanction-type-badge";
import { SanctionStatusBadge } from "@/components/admin/sanction-status-badge";
import { SanctionDialog } from "@/components/admin/sanction-dialog";
import type { AdminUserSanctionRow } from "@/lib/admin-user-detail";
import { FormattedDate } from "@/components/formatted-date";

/** Mirrors V1's admin user detail "sanctions" card, plus the "Issue sanction" button V1 has next to the user's name. */
export function UserSanctionsPanel({
  userId,
  username,
  sanctions,
  canIssue,
}: {
  userId: string;
  username: string | null;
  sanctions: AdminUserSanctionRow[];
  canIssue: boolean;
}) {
  const t = useTranslations("admin.users.sanctionsPanel");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{t("title")}</CardTitle>
        {canIssue && (
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDialogOpen(true)}>
            {t("issueSanction")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {sanctions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sanctions.map((s) => (
              <Link key={s.id} href="/admin/sanctions" className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0 hover:bg-muted/50">
                <div className="flex min-w-0 items-center gap-2">
                  <SanctionTypeBadge type={s.type} />
                  <span className="truncate text-muted-foreground">{s.reason}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {s.teamName && <span>{s.teamName}</span>}
                  <span>{s.endsAt ? <FormattedDate date={s.endsAt} /> : t("permanent")}</span>
                  <SanctionStatusBadge status={s.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>

      {canIssue && <SanctionDialog open={dialogOpen} onOpenChange={setDialogOpen} initialUser={{ id: userId, username }} />}
    </Card>
  );
}
