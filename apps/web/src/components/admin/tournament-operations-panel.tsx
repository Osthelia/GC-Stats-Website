/**
 * GC-Stats - tournament-operations-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/admin/form-field";
import { bulkPatchMatches, bulkCreateMatches, type BulkPatchFieldErrors, type BulkCreateFieldErrors } from "@/actions/admin-tournament-operations";
import { BulkMatchStatusCard } from "@/components/admin/bulk-match-status-card";
import { MatchScoreBackfillCard } from "@/components/admin/match-score-backfill-card";
import type { AdminContainerOption } from "@/lib/admin-tournament-detail";
import type { AdminMatchListRow } from "@/lib/admin-matches";

const ALL_CONTAINERS = "all";
const BEST_OF_VALUES = ["1", "3", "5"] as const;

export function TournamentOperationsPanel({ tournamentId, containers, matches }: { tournamentId: number; containers: AdminContainerOption[]; matches: AdminMatchListRow[] }) {
  const t = useTranslations("admin.tournaments.operations");

  return (
    <div className="flex flex-col gap-6">
      <PatchCard tournamentId={tournamentId} containers={containers} />
      <BulkCreateCard tournamentId={tournamentId} containers={containers} />
      <BulkMatchStatusCard tournamentId={tournamentId} containers={containers} matches={matches} />
      <MatchScoreBackfillCard tournamentId={tournamentId} />
      {containers.length === 0 && <p className="text-sm text-muted-foreground">{t("noContainers")}</p>}
    </div>
  );
}

function PatchCard({ tournamentId, containers }: { tournamentId: number; containers: AdminContainerOption[] }) {
  const t = useTranslations("admin.tournaments.operations");
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<BulkPatchFieldErrors>({});
  const [patch, setPatch] = useState("");
  const [containerId, setContainerId] = useState<string>(ALL_CONTAINERS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const err = (field: keyof BulkPatchFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await bulkPatchMatches(tournamentId, {
        patch,
        containerId: containerId === ALL_CONTAINERS ? null : Number(containerId),
        dateFrom,
        dateTo,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(t("patchSuccess", { count: result.count }));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("patchSectionTitle")}</CardTitle>
        <CardDescription>{t("patchSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("fieldPatch")} htmlFor="op-patch" required error={err("patch")}>
            <Input id="op-patch" placeholder={t("fieldPatchPlaceholder")} value={patch} onChange={(e) => setPatch(e.target.value)} aria-invalid={!!fieldErrors.patch} />
          </FormField>
          <FormField label={t("fieldContainerScope")} htmlFor="op-container" error={err("containerId")}>
            <Select
              items={{ [ALL_CONTAINERS]: t("fieldContainerScopeAll"), ...Object.fromEntries(containers.map((c) => [String(c.id), `${c.stageName} · ${c.name}`])) }}
              value={containerId}
              onValueChange={(v) => v && setContainerId(v)}
            >
              <SelectTrigger id="op-container" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CONTAINERS}>{t("fieldContainerScopeAll")}</SelectItem>
                {containers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.stageName} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("fieldDateFrom")} htmlFor="op-date-from" error={err("dateFrom")}>
            <Input id="op-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-invalid={!!fieldErrors.dateFrom} />
          </FormField>
          <FormField label={t("fieldDateTo")} htmlFor="op-date-to" error={err("dateTo")}>
            <Input id="op-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-invalid={!!fieldErrors.dateTo} />
          </FormField>
        </div>
        <div>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("patchSubmitting") : t("patchSubmitButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BulkCreateCard({ tournamentId, containers }: { tournamentId: number; containers: AdminContainerOption[] }) {
  const t = useTranslations("admin.tournaments.operations");
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<BulkCreateFieldErrors>({});
  const [containerId, setContainerId] = useState<string>(containers[0] ? String(containers[0].id) : "");
  const [count, setCount] = useState("1");
  const [scheduledAt, setScheduledAt] = useState("");
  const [bestOf, setBestOf] = useState<string>("3");

  const err = (field: keyof BulkCreateFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await bulkCreateMatches(tournamentId, {
        containerId: containerId ? Number(containerId) : null,
        count,
        scheduledAt,
        bestOf,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(t("bulkCreateSuccess", { count: result.count }));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("bulkCreateSectionTitle")}</CardTitle>
        <CardDescription>{t("bulkCreateSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormField label={t("fieldTargetContainer")} htmlFor="op-target-container" required error={err("containerId")}>
          <Select items={Object.fromEntries(containers.map((c) => [String(c.id), `${c.stageName} · ${c.name}`]))} value={containerId} onValueChange={(v) => v && setContainerId(v)}>
            <SelectTrigger id="op-target-container" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {containers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.stageName} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label={t("fieldCount")} htmlFor="op-count" required error={err("count")}>
            <Input id="op-count" type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} aria-invalid={!!fieldErrors.count} />
          </FormField>
          <FormField label={t("fieldScheduledAt")} htmlFor="op-scheduled-at" required error={err("scheduledAt")}>
            <Input id="op-scheduled-at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} aria-invalid={!!fieldErrors.scheduledAt} />
          </FormField>
          <FormField label={t("fieldBestOf")} htmlFor="op-best-of" required error={err("bestOf")}>
            <Select items={Object.fromEntries(BEST_OF_VALUES.map((v) => [v, `BO${v}`]))} value={bestOf} onValueChange={(v) => v && setBestOf(v)}>
              <SelectTrigger id="op-best-of" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BEST_OF_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    BO{v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div>
          <Button onClick={handleSubmit} disabled={isPending || containers.length === 0}>
            {isPending ? t("bulkCreateSubmitting") : t("bulkCreateSubmitButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
