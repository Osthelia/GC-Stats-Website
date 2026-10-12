/**
 * GC-Stats - veto-enable-card
 *
 * Site admin switch turning the live veto on or off for a tournament.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";
import { setTournamentVetoEnabled } from "@/actions/veto-management";

export function VetoEnableCard({ tournamentId, enabled, canManage }: { tournamentId: number; enabled: boolean; canManage: boolean }) {
  const t = useTranslations("admin.vetoManagement");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState(enabled);

  function toggle() {
    startTransition(async () => {
      const result = await setTournamentVetoEnabled(tournamentId, !current);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      setCurrent(!current);
      toast.success(t(current ? "disabledSuccess" : "enabledSuccess"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{t("enableTitle")}</CardTitle>
          <Badge variant={current ? "default" : "secondary"}>{current ? t("enabled") : t("disabled")}</Badge>
        </div>
        <CardDescription>{t("enableDescription")}</CardDescription>
      </CardHeader>
      {canManage && (
        <CardContent>
          <Button variant={current ? "outline" : "default"} disabled={isPending} onClick={toggle}>
            {isPending ? t("saving") : current ? t("disableButton") : t("enableButton")}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
