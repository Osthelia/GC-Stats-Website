/**
 * GC-Stats - map-scoreboard-form
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateMapPlayerStats, type MapPlayerStatInput, type MapPlayerStatFieldErrors } from "@/actions/admin-matches";
import { VALORANT_AGENTS } from "@/lib/valorant-agents";
import type { AdminRosterMember, AdminMapPlayerStatRow } from "@/lib/admin-matches";

let rowKeySeq = 0;
function nextRowKey(): string {
  rowKeySeq += 1;
  return `row-${rowKeySeq}`;
}

type ScoreboardRow = MapPlayerStatInput & { key: string; handle: string | null };

function emptyRow(defaultPersonId: string): ScoreboardRow {
  return {
    key: nextRowKey(),
    personId: defaultPersonId,
    handle: null,
    agentName: VALORANT_AGENTS[0],
    valName: null,
    kills: "0",
    deaths: "0",
    assists: "0",
    acs: "0",
    adr: "0",
    kastPercentage: "0",
    firstKills: "0",
    firstDeaths: "0",
    headshotPercentage: "0",
  };
}

function rowsFromExisting(stats: AdminMapPlayerStatRow[], entrantId: number): ScoreboardRow[] {
  return stats
    .filter((s) => s.entrantId === entrantId && s.personId != null)
    .map((s) => ({
      key: nextRowKey(),
      personId: String(s.personId),
      handle: s.handle,
      agentName: s.agentName ?? VALORANT_AGENTS[0],
      valName: s.valName,
      kills: String(s.kills),
      deaths: String(s.deaths),
      assists: String(s.assists),
      acs: String(s.acs),
      adr: String(s.adr),
      kastPercentage: String(s.kastPercentage),
      firstKills: String(s.firstKills),
      firstDeaths: String(s.firstDeaths),
      headshotPercentage: String(s.headshotPercentage),
    }));
}

function TeamScoreboardTable({
  teamName,
  side,
  roster,
  rows,
  onChange,
  fieldErrors,
  canManage,
}: {
  teamName: string;
  side: "a" | "b";
  roster: AdminRosterMember[];
  rows: ScoreboardRow[];
  onChange: (rows: ScoreboardRow[]) => void;
  fieldErrors: MapPlayerStatFieldErrors;
  canManage: boolean;
}) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const fieldErr = (key: string) => (fieldErrors[key] ? t(`fieldError.${fieldErrors[key]}`) : undefined);
  const rosterItems: Record<string, string> = Object.fromEntries(roster.map((p) => [String(p.id), p.handle]));
  // A saved row's personId can point outside this entrant's locked roster
  // (e.g. resolved by Fetch through a Riot account already linked to someone
  // not added to entrant_members) — add its handle so the trigger still
  // shows a name instead of falling back to the raw id.
  for (const row of rows) {
    if (row.handle && !(row.personId in rosterItems)) rosterItems[row.personId] = row.handle;
  }
  const agentItems: Record<string, string> = Object.fromEntries(VALORANT_AGENTS.map((a) => [a, a]));

  function updateRow(key: string, patch: Partial<ScoreboardRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  function addRow() {
    if (roster.length === 0) return;
    onChange([...rows, emptyRow(String(roster[0]!.id))]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{teamName}</span>
        {canManage && (
          <Button type="button" variant="outline" size="sm" disabled={roster.length === 0} onClick={addRow}>
            {t("addPlayerRow")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const prefix = `${side}-${index}`;
          return (
            <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
              <div className="flex w-40 flex-col gap-1">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t("columnPlayer")}</span>
                <Select items={rosterItems} value={row.personId} onValueChange={(v) => v && updateRow(row.key, { personId: v })}>
                  <SelectTrigger className="w-full" disabled={!canManage} aria-invalid={!!fieldErrors[`${prefix}-personId`]}>
                    <SelectValue placeholder={t("selectPlayerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roster.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.handle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErr(`${prefix}-personId`) && (
                  <p role="alert" className="text-xs text-destructive">
                    {fieldErr(`${prefix}-personId`)}
                  </p>
                )}
              </div>

              <div className="flex w-28 flex-col gap-1">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t("columnAgent")}</span>
                <Select items={agentItems} value={row.agentName} onValueChange={(v) => v && updateRow(row.key, { agentName: v })}>
                  <SelectTrigger className="w-full" disabled={!canManage} aria-invalid={!!fieldErrors[`${prefix}-agentName`]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALORANT_AGENTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErr(`${prefix}-agentName`) && (
                  <p role="alert" className="text-xs text-destructive">
                    {fieldErr(`${prefix}-agentName`)}
                  </p>
                )}
              </div>

              {(
                [
                  ["kills", "columnKills"],
                  ["deaths", "columnDeaths"],
                  ["assists", "columnAssists"],
                  ["acs", "columnAcs"],
                  ["adr", "columnAdr"],
                  ["kastPercentage", "columnKast"],
                  ["firstKills", "columnFirstKills"],
                  ["firstDeaths", "columnFirstDeaths"],
                  ["headshotPercentage", "columnHeadshot"],
                ] as const
              ).map(([field, labelKey]) => (
                <div key={field} className="flex w-16 flex-col gap-1">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t(labelKey)}</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-8"
                    value={row[field]}
                    disabled={!canManage}
                    onChange={(e) => updateRow(row.key, { [field]: e.target.value } as Partial<ScoreboardRow>)}
                    aria-invalid={!!fieldErrors[`${prefix}-${field}`]}
                  />
                  {fieldErr(`${prefix}-${field}`) && <p className="text-[10px] text-destructive">{fieldErr(`${prefix}-${field}`)}</p>}
                </div>
              ))}

              {canManage && (
                <Button type="button" variant="outline" size="sm" onClick={() => removeRow(row.key)}>
                  {t("removePlayerRow")}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MapScoreboardForm({
  mapId,
  entrantAId,
  entrantBId,
  entrantAName,
  entrantBName,
  rosterA,
  rosterB,
  initialStats,
  canManage,
}: {
  mapId: number;
  entrantAId: number;
  entrantBId: number;
  entrantAName: string;
  entrantBName: string;
  rosterA: AdminRosterMember[];
  rosterB: AdminRosterMember[];
  initialStats: AdminMapPlayerStatRow[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<MapPlayerStatFieldErrors>({});
  const [rowsA, setRowsA] = useState<ScoreboardRow[]>(() => rowsFromExisting(initialStats, entrantAId));
  const [rowsB, setRowsB] = useState<ScoreboardRow[]>(() => rowsFromExisting(initialStats, entrantBId));

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateMapPlayerStats(mapId, rowsA, rowsB);
      if (!result.ok) {
        if ("fieldErrors" in result) setFieldErrors(result.fieldErrors);
        toast.error(t("scoreboardSaveError"));
        return;
      }
      router.refresh();
      toast.success(t("scoreboardSaveSuccess"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm tracking-wide text-muted-foreground uppercase">{t("manualScoreboardHeading")}</CardTitle>
        <CardDescription>{t("manualScoreboardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TeamScoreboardTable teamName={entrantAName} side="a" roster={rosterA} rows={rowsA} onChange={setRowsA} fieldErrors={fieldErrors} canManage={canManage} />
          <TeamScoreboardTable teamName={entrantBName} side="b" roster={rosterB} rows={rowsB} onChange={setRowsB} fieldErrors={fieldErrors} canManage={canManage} />
        </div>

        {canManage && (
          <Button className="self-start" disabled={isPending} onClick={handleSave}>
            {isPending ? t("saving") : t("saveScoreboard")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
