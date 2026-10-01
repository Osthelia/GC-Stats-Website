/**
 * GC-Stats - api-keys-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { RevealApiKeyDialog } from "@/components/dashboard/reveal-api-key-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DashboardApiKeyRow, RegenerateApiKeyResult } from "@/lib/dashboard-api-keys";

/** Shared table of self-service API keys — used by both the org-scoped space (/dashboard/{id}/api-keys) and the personal one (/dashboard/api-keys). Only `statsBasePath`/`onRegenerate` differ between the two callers. */
export function ApiKeysPanel({
  keys,
  canManage,
  statsBasePath,
  onRegenerate,
}: {
  keys: DashboardApiKeyRow[];
  canManage: boolean;
  statsBasePath: string;
  onRegenerate: (id: number) => Promise<RegenerateApiKeyResult>;
}) {
  const t = useTranslations("dashboard.apiKeys");
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<DashboardApiKeyRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmRegenerate() {
    if (!regenerating) return;
    const key = regenerating;
    setRegenerating(null);
    startTransition(async () => {
      const result = await onRegenerate(key.id);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      setRevealKey(result.plainKey);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("heading")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnClientName")}</TableHead>
                  <TableHead>{t("columnKey")}</TableHead>
                  <TableHead>{t("columnRateLimit")}</TableHead>
                  <TableHead>{t("columnRequests")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                )}
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.clientName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{key.keyHashPreview}…</TableCell>
                    <TableCell className="text-muted-foreground">{key.rateLimit ?? t("noRateLimit")}</TableCell>
                    <TableCell className="text-muted-foreground">{key.requestCount}</TableCell>
                    <TableCell>
                      <ActiveStatusBadge active={key.isActive} activeLabel={t("statusActive")} inactiveLabel={t("statusInactive")} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" render={<Link href={`${statsBasePath}/${key.id}`} />}>
                          <BarChart3 className="size-4" />
                          {t("statsButton")}
                        </Button>
                        {canManage && (
                          <Button variant="outline" size="sm" disabled={isPending} onClick={() => setRegenerating(key)}>
                            {t("regenerateButton")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RevealApiKeyDialog plainKey={revealKey} onClose={() => setRevealKey(null)} />

      <ConfirmDialog
        open={regenerating !== null}
        onOpenChange={(next) => {
          if (!next) setRegenerating(null);
        }}
        title={t("regenerateButton")}
        description={regenerating ? t("regenerateConfirm", { name: regenerating.clientName }) : ""}
        confirmLabel={t("regenerateButton")}
        cancelLabel={t("cancel")}
        onConfirm={confirmRegenerate}
        isPending={isPending}
      />
    </div>
  );
}
