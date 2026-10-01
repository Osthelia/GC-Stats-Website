/**
 * GC-Stats - match-veto-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveMatchVeto, type VetoRowInput } from "@/actions/admin-matches";
import { MapPicker } from "@/components/admin/map-picker";
import type { AdminMatchDetail, AdminVetoRow } from "@/lib/admin-matches";

const NONE = "none";
const VETO_SLOTS = 7;
type ActionType = "none" | "ban" | "pick" | "decider";
type Side = "none" | "atk" | "def";

type RowState = { entrantId: string; mapName: string; type: ActionType; side: Side; sidePickedBy: string };

function emptyRow(): RowState {
  return { entrantId: NONE, mapName: NONE, type: "none", side: "none", sidePickedBy: NONE };
}

// V1's VETO_DEFAULTS_BY_FORMAT (Website/app/Http/Controllers/Admin/MatchController.php) — only applied when no veto rows exist yet.
function defaultTypesForBestOf(bestOf: number): ActionType[] {
  if (bestOf <= 1) return ["ban", "ban", "ban", "ban", "ban", "ban", "decider"];
  if (bestOf === 3) return ["ban", "ban", "pick", "pick", "ban", "ban", "decider"];
  return ["ban", "ban", "pick", "pick", "pick", "pick", "decider"];
}

function buildInitialRows(initial: AdminVetoRow[], bestOf: number): RowState[] {
  if (initial.length > 0) {
    const rows = initial.map(
      (v): RowState => ({
        entrantId: String(v.entrantId),
        mapName: v.mapName,
        type: v.type,
        side: v.side ?? "none",
        sidePickedBy: v.sidePickedByEntrantId !== null ? String(v.sidePickedByEntrantId) : NONE,
      })
    );
    while (rows.length < VETO_SLOTS) rows.push(emptyRow());
    return rows.slice(0, VETO_SLOTS);
  }
  return defaultTypesForBestOf(bestOf).map((type) => ({ ...emptyRow(), type }));
}

export function MatchVetoPanel({
  match,
  entrants,
  initialVetos,
  canManage,
}: {
  match: AdminMatchDetail;
  entrants: { id: number; displayName: string }[];
  initialVetos: AdminVetoRow[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.tournaments.matches.veto");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(initialVetos, match.bestOf));
  const [firstTeam, setFirstTeam] = useState<string>(match.entrantAId !== null ? String(match.entrantAId) : NONE);

  const canEditVeto = match.entrantAId !== null && match.entrantBId !== null;
  const otherTeam = match.entrantAId !== null && match.entrantBId !== null ? (String(match.entrantAId) === firstTeam ? String(match.entrantBId) : String(match.entrantAId)) : NONE;

  const entrantOptions = useMemo(() => {
    if (match.entrantAId === null || match.entrantBId === null) return [];
    const nameFor = (id: number) => entrants.find((e) => e.id === id)?.displayName ?? `#${id}`;
    return [
      { id: match.entrantAId, label: nameFor(match.entrantAId) },
      { id: match.entrantBId, label: nameFor(match.entrantBId) },
    ];
  }, [match.entrantAId, match.entrantBId, entrants]);

  function updateRow(index: number, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (next.type === "ban") {
          next.side = "none";
          next.sidePickedBy = NONE;
        }
        // BO1 decider exception (2026-09-01): the team credited for the
        // decider map and the team choosing side on it are the same team,
        // not opposite teams like V1's general default — force + lock it.
        if (match.bestOf === 1 && next.type === "decider") {
          next.sidePickedBy = next.entrantId;
        }
        return next;
      })
    );
  }

  function applyFirstTeam() {
    if (firstTeam === NONE) return;
    setRows((prev) => prev.map((row, i) => ({ ...row, entrantId: i % 2 === 0 ? firstTeam : otherTeam })));
  }

  function handleSave() {
    setError(null);
    const submitRows: VetoRowInput[] = [];
    for (const row of rows) {
      if (row.type === "none" || row.entrantId === NONE || row.mapName === NONE) continue;
      submitRows.push({
        entrantId: Number(row.entrantId),
        mapName: row.mapName,
        type: row.type,
        side: row.type === "ban" ? null : row.side === "none" ? null : row.side,
        sidePickedByEntrantId: row.type === "ban" ? null : row.sidePickedBy === NONE ? null : Number(row.sidePickedBy),
      });
    }
    startTransition(async () => {
      const result = await saveMatchVeto(match.id, submitRows);
      if (!result.ok) {
        setError(t(`error.${result.fieldErrors.rows}`));
        return;
      }
      router.refresh();
      toast.success(t("saveSuccess"));
    });
  }

  const typeItems: Record<string, string> = { none: t("typeNone"), ban: t("typeBan"), pick: t("typePick"), decider: t("typeDecider") };
  const sideItems: Record<string, string> = { none: t("sideNone"), atk: t("sideAtk"), def: t("sideDef") };
  const entrantItems: Record<string, string> = { [NONE]: t("teamNone"), ...Object.fromEntries(entrantOptions.map((e) => [String(e.id), e.label])) };

  if (!canEditVeto) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("heading")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("needsBothEntrants")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("heading")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canManage && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("firstTeamLabel")}</span>
              <Select items={entrantItems} value={firstTeam} onValueChange={(v) => v && setFirstTeam(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entrantOptions.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={applyFirstTeam}>
              {t("applyFirstTeamButton")}
            </Button>
          </div>
        )}

        {/* V1-style stacked veto rows (admin/matches/veto.blade.php) — one card per slot rather than a cramped table row, each grouped [label | team | map | type | side | side-picker]. */}
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const sideDisabled = row.type === "ban" || row.type === "none" || !canManage;
            const bo1DeciderLocked = match.bestOf === 1 && row.type === "decider";
            return (
              <div key={index} className="rounded-lg border p-3">
                <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[80px_1fr_1fr_1fr_1fr_1fr]">
                  <span className="pt-2.5 text-xs font-bold tracking-tight uppercase">
                    {t("mapLabel")} {index + 1}
                  </span>

                  <Select items={entrantItems} value={row.entrantId} onValueChange={(v) => v && updateRow(index, { entrantId: v })}>
                    <SelectTrigger className="w-full text-xs" disabled={!canManage}>
                      <SelectValue placeholder={t("teamNone")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("teamNone")}</SelectItem>
                      {entrantOptions.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <MapPicker
                    value={row.mapName === NONE ? null : row.mapName}
                    onChange={(m) => updateRow(index, { mapName: m })}
                    excludedMaps={rows.filter((_, i) => i !== index).map((r) => r.mapName)}
                    placeholder={t("mapNone")}
                    clearLabel={t("mapNone")}
                    unknownLabel={t("mapUnknown")}
                    searchPlaceholder={t("mapSearchPlaceholder")}
                    noResultsLabel={t("mapNoResults")}
                    disabled={!canManage}
                  />

                  <Select items={typeItems} value={row.type} onValueChange={(v) => v && updateRow(index, { type: v as ActionType })}>
                    <SelectTrigger className="w-full text-xs" disabled={!canManage}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("typeNone")}</SelectItem>
                      <SelectItem value="ban">{t("typeBan")}</SelectItem>
                      <SelectItem value="pick">{t("typePick")}</SelectItem>
                      <SelectItem value="decider">{t("typeDecider")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select items={sideItems} value={row.side} onValueChange={(v) => v && updateRow(index, { side: v as Side })}>
                    <SelectTrigger className="w-full text-xs" disabled={sideDisabled}>
                      <SelectValue placeholder={t("sideNone")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("sideNone")}</SelectItem>
                      <SelectItem value="atk">{t("sideAtk")}</SelectItem>
                      <SelectItem value="def">{t("sideDef")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select items={entrantItems} value={bo1DeciderLocked ? row.entrantId : row.sidePickedBy} onValueChange={(v) => v && updateRow(index, { sidePickedBy: v })}>
                    <SelectTrigger className="w-full text-xs" disabled={sideDisabled || bo1DeciderLocked}>
                      <SelectValue placeholder={t("teamNone")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("teamNone")}</SelectItem>
                      {entrantOptions.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        {canManage && (
          <div>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? t("saving") : t("saveButton")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
