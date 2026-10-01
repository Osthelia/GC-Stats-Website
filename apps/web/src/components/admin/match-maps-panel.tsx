/**
 * GC-Stats - match-maps-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { MapPicker } from "@/components/admin/map-picker";
import { addMap, type MapInput, type MapFieldErrors } from "@/actions/admin-matches";
import { MAP_OPTIONS, mapSplashUrl } from "@/lib/valorant-maps";
import { mapCompletedBadgeClass } from "@/lib/status-colors";
import type { AdminMapRow } from "@/lib/admin-matches";

function emptyInput(order: number): MapInput {
  return { mapName: MAP_OPTIONS[0], order: String(order), teamAScore: "", teamBScore: "", isCompleted: false, note: "", apiMatchId: "" };
}

/** Map preview card linking to the dedicated `.../maps/{mapId}` admin page — V1's admin/matches/show.blade.php map cards use the map's splash art as a background, not the tactical minimap (that one's reserved for heatmaps, cf. lib/valorant-minimaps.ts). */
function MapCard({ map, tournamentId, matchId, t }: { map: AdminMapRow; tournamentId: number; matchId: number; t: ReturnType<typeof useTranslations> }) {
  const art = mapSplashUrl(map.mapName);
  const scoreLabel = map.teamAScore !== null && map.teamBScore !== null ? `${map.teamAScore === -1 ? "FF" : map.teamAScore} - ${map.teamBScore === -1 ? "FF" : map.teamBScore}` : "–";

  return (
    <Link
      href={`/admin/tournaments/${tournamentId}/matches/${matchId}/maps/${map.id}`}
      className="relative flex min-h-16 items-center overflow-hidden rounded-lg border p-3 transition-colors hover:border-primary/50"
    >
      <div className="absolute inset-0 bg-muted" />
      {art && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, next/image adds no value here */}
          <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        </>
      )}

      <div className="relative min-w-0 flex-1 text-white">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-white/70">#{map.order}</span>
          <span className="truncate text-sm font-semibold drop-shadow">{map.mapName ?? t("mapUnknown")}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-xs text-white/80">{scoreLabel}</span>
          <Badge className={mapCompletedBadgeClass(map.isCompleted)}>{map.isCompleted ? t("mapFinished") : t("mapNotFinished")}</Badge>
        </div>
      </div>
    </Link>
  );
}

function AddMapDialog({ matchId, nextOrder, existingMapNames, open, onOpenChange }: { matchId: number; nextOrder: number; existingMapNames: string[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<MapFieldErrors>({});
  const [value, setValue] = useState<MapInput>(emptyInput(nextOrder));

  useEffect(() => {
    if (open) {
      setValue(emptyInput(nextOrder));
      setFieldErrors({});
    }
  }, [open, nextOrder]);

  const set = (patch: Partial<MapInput>) => setValue((prev) => ({ ...prev, ...patch }));
  const fieldErr = (field: keyof MapFieldErrors) => (fieldErrors[field] ? t(`fieldError.${fieldErrors[field]}`) : undefined);

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addMap(matchId, value);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        toast.error(t("mapSaveError"));
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("mapAddSuccess"));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("columnOrder")} htmlFor="map-order" required error={fieldErr("order")}>
              <Input id="map-order" type="number" min={1} value={value.order} onChange={(e) => set({ order: e.target.value })} aria-invalid={!!fieldErrors.order} />
            </FormField>
            <FormField label={t("columnMap")} htmlFor="map-name" required error={fieldErr("mapName")}>
              <MapPicker
                value={value.mapName}
                onChange={(m) => set({ mapName: m })}
                excludedMaps={existingMapNames}
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
            <Input id="map-note" maxLength={500} value={value.note} onChange={(e) => set({ note: e.target.value })} aria-invalid={!!fieldErrors.note} />
          </FormField>

          <FormField label={t("columnApiMatchId")} htmlFor="map-api-match-id" hint={t("apiMatchIdHint")} error={fieldErr("apiMatchId")}>
            <Input id="map-api-match-id" className="font-mono text-xs" value={value.apiMatchId} onChange={(e) => set({ apiMatchId: e.target.value })} aria-invalid={!!fieldErrors.apiMatchId} />
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.isCompleted} onCheckedChange={(c) => set({ isCompleted: c === true })} />
            {t("columnCompleted")}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleAdd} disabled={isPending}>
            {isPending ? t("saving") : t("addMapButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MatchMapsPanel({ tournamentId, matchId, maps, canManage }: { tournamentId: number; matchId: number; maps: AdminMapRow[]; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const [creating, setCreating] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{t("heading")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        {canManage && <Button onClick={() => setCreating(true)}>{t("createButton")}</Button>}
      </CardHeader>
      <CardContent>
        {maps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {maps.map((map) => (
              <MapCard key={map.id} map={map} tournamentId={tournamentId} matchId={matchId} t={t} />
            ))}
          </div>
        )}
      </CardContent>

      <AddMapDialog
        matchId={matchId}
        nextOrder={maps.length + 1}
        existingMapNames={maps.map((m) => m.mapName).filter((m): m is string => m !== null)}
        open={creating}
        onOpenChange={setCreating}
      />
    </Card>
  );
}
