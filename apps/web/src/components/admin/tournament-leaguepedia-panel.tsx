/**
 * GC-Stats - tournament-leaguepedia-panel
 *
 * The Leaguepedia base page of a LoL tournament and its game list: save the page (this reads the games),
 * or refresh the list from the saved page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveLeaguepediaBasePage, refreshLeaguepediaGameList, type LeaguepediaLinkResult } from "@/actions/admin-leaguepedia";

export interface LeaguepediaPanelStatus {
  overviewPage: string | null;
  /** ISO time of the last read of the game list, null when it was never read. */
  gamesFetchedAt: string | null;
  gameCount: number;
}

export function TournamentLeaguepediaPanel({ tournamentId, status, canManage }: { tournamentId: number; status: LeaguepediaPanelStatus; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.leaguepedia");
  const locale = useLocale();
  const router = useRouter();
  // Separate transitions, so the refresh button shows its spinner and the save button does not.
  const [isSaving, startSaving] = useTransition();
  const [isRefreshing, startRefreshing] = useTransition();
  const isPending = isSaving || isRefreshing;
  const [basePage, setBasePage] = useState(status.overviewPage ?? "");

  function run(start: typeof startSaving, action: () => Promise<LeaguepediaLinkResult>) {
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("success", { count: result.games }));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="leaguepedia-base-page">{t("basePageLabel")}</Label>
          <Input
            id="leaguepedia-base-page"
            value={basePage}
            onChange={(event) => setBasePage(event.target.value)}
            placeholder={t("basePagePlaceholder")}
            disabled={!canManage || isPending}
          />
          <p className="text-xs text-muted-foreground">{t("basePageHint")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => run(startSaving, () => saveLeaguepediaBasePage(tournamentId, basePage))} disabled={!canManage || isPending || basePage.trim() === ""}>
            {isSaving ? t("saving") : t("save")}
          </Button>
          <Button variant="outline" onClick={() => run(startRefreshing, () => refreshLeaguepediaGameList(tournamentId))} disabled={!canManage || isPending || !status.overviewPage}>
            {isRefreshing ? <Loader2Icon className="animate-spin" /> : null}
            {t("refresh")}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {status.gamesFetchedAt
            ? t("lastFetched", { date: new Date(status.gamesFetchedAt).toLocaleString(locale), count: status.gameCount })
            : t("neverFetched")}
        </p>
      </CardContent>
    </Card>
  );
}
