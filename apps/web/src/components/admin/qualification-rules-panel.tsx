/**
 * GC-Stats - qualification-rules-panel
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QualificationRuleDialog } from "@/components/admin/qualification-rule-dialog";
import { deleteQualificationRule } from "@/actions/admin-bracket-qualifications";
import type { AdminQualificationRule } from "@/lib/admin-bracket-qualifications";
import type { AdminContainerOption } from "@/lib/admin-tournament-detail";
import type { AdminMatchListRow } from "@/lib/admin-matches";

function sourceLabel(rule: AdminQualificationRule, t: ReturnType<typeof useTranslations>): string {
  if (rule.source.kind === "rank") {
    return rule.source.rankFrom === rule.source.rankTo
      ? t("sourceRankSingle", { from: rule.source.rankFrom, container: rule.source.containerName, stage: rule.source.stageName })
      : t("sourceRank", { from: `${rule.source.rankFrom}-${rule.source.rankTo}`, container: rule.source.containerName, stage: rule.source.stageName });
  }
  const label = rule.source.label ?? t("matchLabelFallback", { round: rule.source.round });
  return rule.source.outcome === "winner"
    ? t("sourceMatchWinner", { label, container: rule.source.containerName, stage: rule.source.stageName })
    : t("sourceMatchLoser", { label, container: rule.source.containerName, stage: rule.source.stageName });
}

function destinationLabel(rule: AdminQualificationRule, t: ReturnType<typeof useTranslations>): string {
  if (rule.destination.kind === "container") {
    return t("destinationContainer", { container: rule.destination.containerName, stage: rule.destination.stageName, tournament: rule.destination.tournamentName });
  }
  return t("destinationPlacement", { placement: rule.destination.placement, label: rule.destination.placementLabel });
}

export function QualificationRulesPanel({
  tournamentId,
  rules,
  groupContainers,
  matches,
  canManage,
}: {
  tournamentId: number;
  rules: AdminQualificationRule[];
  groupContainers: AdminContainerOption[];
  matches: AdminMatchListRow[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.tournaments.qualifications");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AdminQualificationRule | null>(null);

  function openCreate() {
    setEditingRule(null);
    setDialogOpen(true);
  }

  function openEdit(rule: AdminQualificationRule) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  function handleDelete(rule: AdminQualificationRule) {
    if (!window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const result = await deleteQualificationRule(rule.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("deleteSuccess"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t("heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            {t("addButton")}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnSource")}</TableHead>
              <TableHead>{t("columnDestination")}</TableHead>
              <TableHead>{t("columnResult")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {t("listEmpty")}
                </TableCell>
              </TableRow>
            )}
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="text-sm">{sourceLabel(rule, t)}</TableCell>
                <TableCell className="text-sm">{destinationLabel(rule, t)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{rule.results.length > 0 ? rule.results.map((r) => r.entrantName).join(", ") : t("resultPending")}</TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end gap-3">
                      <button type="button" className="text-sm text-primary hover:underline" onClick={() => openEdit(rule)}>
                        {t("editButton")}
                      </button>
                      <button type="button" className="text-sm text-destructive hover:underline disabled:opacity-50" disabled={isPending} onClick={() => handleDelete(rule)}>
                        {t("deleteButton")}
                      </button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <QualificationRuleDialog tournamentId={tournamentId} rule={editingRule} groupContainers={groupContainers} matches={matches} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
