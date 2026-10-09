/**
 * GC-Stats - team-name-history-panel
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HiddenBadge } from "@/components/admin/hidden-badge";
import { RequiredMark } from "@/components/admin/required-mark";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  addTeamNameHistoryEntry,
  deleteTeamNameHistoryEntry,
  toggleTeamNameHistoryVisibility,
  type NameHistoryFieldErrors,
} from "@/actions/admin-teams";
import type { AdminTeamNameHistoryEntry } from "@/lib/admin-teams";

export function TeamNameHistoryPanel({ teamId, initialEntries }: { teamId: number; initialEntries: AdminTeamNameHistoryEntry[] }) {
  const t = useTranslations("admin.teams.edit");
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [fieldErrors, setFieldErrors] = useState<NameHistoryFieldErrors>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addTeamNameHistoryEntry(teamId, name, from, until);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setName("");
      setFrom("");
      setUntil("");
      toast.success(t("nameHistoryAddSubmit"));
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteTeamNameHistoryEntry(id);
      if (!result.ok) {
        setConfirmDeleteId(null);
        toast.error(t(`nameHistoryError.${result.error}` as "nameHistoryError.notFound"));
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteId(null);
    });
  }

  function handleToggleVisibility(id: number, current: boolean) {
    startTransition(async () => {
      const result = await toggleTeamNameHistoryVisibility(id, !current);
      if (!result.ok) {
        toast.error(t(`nameHistoryError.${result.error}` as "nameHistoryError.notFound"));
        return;
      }
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, isVisible: !current } : e)));
    });
  }

  const err = (field: keyof NameHistoryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionNameHistory")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 border-b pb-4">
          <p className="text-sm font-medium">{t("nameHistoryAddTitle")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name-history-name">
                {t("nameHistoryFieldName")}
                <RequiredMark />
              </Label>
              <Input id="name-history-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} />
              {err("name") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("name")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name-history-from">
                {t("nameHistoryFieldFrom")}
                <RequiredMark />
              </Label>
              <Input id="name-history-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-invalid={!!fieldErrors.from} />
              {err("from") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("from")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name-history-until">{t("nameHistoryFieldUntil")}</Label>
              <Input id="name-history-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-40" aria-invalid={!!fieldErrors.until} />
              {err("until") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("until")}
                </p>
              )}
            </div>
            <Button variant="outline" disabled={isPending} onClick={handleAdd}>
              {t("nameHistoryAddSubmit")}
            </Button>
          </div>
        </div>
        {entries.length === 0 && <p className="text-sm text-muted-foreground">{t("nameHistoryEmpty")}</p>}

        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{entry.name}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.until ? t("nameHistoryPeriod", { since: entry.since ?? "?", until: entry.until }) : t("nameHistoryOngoing", { since: entry.since ?? "?" })}
                </span>
                {!entry.isVisible && <HiddenBadge>{t("nameHistoryHidden")}</HiddenBadge>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" disabled={isPending} onClick={() => handleToggleVisibility(entry.id, entry.isVisible)}>
                  {entry.isVisible ? t("nameHistoryHide") : t("nameHistoryShow")}
                </Button>
                <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setConfirmDeleteId(entry.id)}>
                  {t("nameHistoryDelete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title={t("confirmTitle")}
        description={t("nameHistoryDeleteConfirm")}
        confirmLabel={t("nameHistoryDelete")}
        cancelLabel={t("cancel")}
        onConfirm={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
        isPending={isPending}
        destructive
      />
    </Card>
  );
}
