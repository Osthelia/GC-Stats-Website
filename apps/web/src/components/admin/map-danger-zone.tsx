/**
 * GC-Stats - map-danger-zone
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteMap, resetMap } from "@/actions/admin-matches";

export function MapDangerZone({ mapId, tournamentId, matchId }: { mapId: number; tournamentId: number; matchId: number }) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const router = useRouter();
  const [isResetPending, startReset] = useTransition();
  const [isDeletePending, startDelete] = useTransition();

  function handleReset() {
    if (!window.confirm(t("resetMapConfirm"))) return;
    startReset(async () => {
      const result = await resetMap(mapId);
      if (!result.ok) {
        toast.error(t("resetMapError"));
        return;
      }
      router.refresh();
      toast.success(t("resetMapSuccess"));
    });
  }

  function handleDelete() {
    if (!window.confirm(t("deleteMapConfirm"))) return;
    startDelete(async () => {
      const result = await deleteMap(mapId);
      if (!result.ok) {
        toast.error(t("mapDeleteError"));
        return;
      }
      toast.success(t("mapDeleteSuccess"));
      router.push(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
    });
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-sm tracking-wide text-destructive uppercase">{t("dangerZoneHeading")}</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" disabled={isResetPending} onClick={handleReset}>
          {t("resetMapButton")}
        </Button>
        <Button variant="outline" disabled={isDeletePending} onClick={handleDelete} className="text-destructive hover:text-destructive">
          {t("deleteButton")}
        </Button>
      </CardContent>
    </Card>
  );
}
