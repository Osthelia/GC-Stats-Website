/**
 * GC-Stats - map-detail-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/admin/form-field";
import { MapFetchControls } from "@/components/admin/map-fetch-controls";
import { MapPicker } from "@/components/admin/map-picker";
import { updateMap, type MapInput, type MapFieldErrors } from "@/actions/admin-matches";
import { MAP_UNKNOWN } from "@/lib/valorant-maps";
import type { AdminMapRow } from "@/lib/admin-matches";

/**
 * "Basic info" + "Riot data" cards on the dedicated map admin page (5/12+7/12
 * row). One component owns the form state so a Merge in the right card can
 * update the apiMatchId field in the left card.
 */
export function MapDetailForm({ map, canManage }: { map: AdminMapRow; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<MapFieldErrors>({});
  const [value, setValue] = useState<MapInput>({
    mapName: map.mapName ?? MAP_UNKNOWN,
    order: String(map.order),
    teamAScore: map.teamAScore !== null ? String(map.teamAScore) : "",
    teamBScore: map.teamBScore !== null ? String(map.teamBScore) : "",
    isCompleted: map.isCompleted,
    note: map.note ?? "",
    apiMatchId: map.apiMatchId ?? "",
  });

  const set = (patch: Partial<MapInput>) => setValue((prev) => ({ ...prev, ...patch }));
  const fieldErr = (field: keyof MapFieldErrors) => (fieldErrors[field] ? t(`fieldError.${fieldErrors[field]}`) : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateMap(map.id, value);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        toast.error(t("mapSaveError"));
        return;
      }
      router.refresh();
      toast.success(t("mapUpdateSuccess"));
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm tracking-wide text-muted-foreground uppercase">{t("basicInfoHeading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <fieldset disabled={!canManage} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("columnOrder")} htmlFor="map-order" required error={fieldErr("order")}>
                  <Input id="map-order" type="number" min={1} value={value.order} onChange={(e) => set({ order: e.target.value })} aria-invalid={!!fieldErrors.order} />
                </FormField>
                <FormField label={t("columnMap")} htmlFor="map-name" required error={fieldErr("mapName")}>
                  <MapPicker
                    value={value.mapName}
                    onChange={(m) => set({ mapName: m })}
                    excludedMaps={[]}
                    allowClear={false}
                    placeholder={t("mapNone")}
                    unknownLabel={t("mapUnknown")}
                    searchPlaceholder={t("mapSearchPlaceholder")}
                    noResultsLabel={t("mapNoResults")}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("columnScoreA")} htmlFor="map-score-a" hint={t("scoreForfeitHint")} error={fieldErr("teamAScore")}>
                  <Input id="map-score-a" type="number" min={-1} value={value.teamAScore} onChange={(e) => set({ teamAScore: e.target.value })} aria-invalid={!!fieldErrors.teamAScore} />
                </FormField>
                <FormField label={t("columnScoreB")} htmlFor="map-score-b" error={fieldErr("teamBScore")}>
                  <Input id="map-score-b" type="number" min={-1} value={value.teamBScore} onChange={(e) => set({ teamBScore: e.target.value })} aria-invalid={!!fieldErrors.teamBScore} />
                </FormField>
              </div>

              <FormField label={t("columnNote")} htmlFor="map-note" error={fieldErr("note")}>
                <Textarea id="map-note" rows={3} maxLength={500} value={value.note} onChange={(e) => set({ note: e.target.value })} aria-invalid={!!fieldErrors.note} />
              </FormField>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={value.isCompleted} onCheckedChange={(c) => set({ isCompleted: c === true })} />
                {t("columnCompleted")}
              </label>

              {canManage && (
                <Button className="self-start" disabled={isPending} onClick={handleSave}>
                  {isPending ? t("saving") : t("save")}
                </Button>
              )}
            </fieldset>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-7">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm tracking-wide text-muted-foreground uppercase">{t("riotDataHeading")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label={t("columnApiMatchId")} htmlFor="map-api-match-id" hint={t("apiMatchIdHint")} error={fieldErr("apiMatchId")}>
              <Input
                id="map-api-match-id"
                className="font-mono text-xs"
                value={value.apiMatchId}
                onChange={(e) => set({ apiMatchId: e.target.value })}
                aria-invalid={!!fieldErrors.apiMatchId}
                disabled={!canManage}
              />
            </FormField>
            <MapFetchControls mapId={map.id} apiMatchId={value.apiMatchId.trim() || null} canManage={canManage} onMerged={(apiMatchId) => set({ apiMatchId })} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
