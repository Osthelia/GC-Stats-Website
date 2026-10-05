/**
 * GC-Stats - qualification-rule-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { QualificationContainerPicker } from "@/components/admin/qualification-container-picker";
import { createQualificationRule, updateQualificationRule, type QualificationRuleFieldErrors, type QualificationRuleInput } from "@/actions/admin-bracket-qualifications";
import type { AdminQualificationRule } from "@/lib/admin-bracket-qualifications";
import type { AdminContainerOption } from "@/lib/admin-tournament-detail";
import type { AdminMatchListRow } from "@/lib/admin-matches";

type FormState = {
  sourceKind: "rank" | "match";
  sourceContainerId: number | null;
  rankFrom: string;
  rankTo: string;
  sourceMatchId: number | null;
  outcome: "winner" | "loser" | null;
  destinationKind: "container" | "placement";
  destinationContainer: { id: number; name: string; stageName: string; tournamentName: string } | null;
  placement: string;
  placementLabel: string;
  points: string;
  cashPrizeAmount: string;
  cashPrizeCurrency: string;
};

function emptyState(defaultSourceKind: "rank" | "match"): FormState {
  return {
    sourceKind: defaultSourceKind,
    sourceContainerId: null,
    rankFrom: "",
    rankTo: "",
    sourceMatchId: null,
    outcome: null,
    destinationKind: "placement",
    destinationContainer: null,
    placement: "",
    placementLabel: "",
    points: "",
    cashPrizeAmount: "",
    cashPrizeCurrency: "",
  };
}

function stateFromRule(rule: AdminQualificationRule): FormState {
  const base = emptyState(rule.source.kind);
  if (rule.source.kind === "rank") {
    base.sourceContainerId = rule.source.containerId;
    base.rankFrom = String(rule.source.rankFrom);
    base.rankTo = String(rule.source.rankTo);
  } else {
    base.sourceMatchId = rule.source.matchId;
    base.outcome = rule.source.outcome;
  }
  base.destinationKind = rule.destination.kind;
  if (rule.destination.kind === "container") {
    base.destinationContainer = { id: rule.destination.containerId, name: rule.destination.containerName, stageName: rule.destination.stageName, tournamentName: rule.destination.tournamentName };
  } else {
    base.placement = String(rule.destination.placement);
    base.placementLabel = rule.destination.placementLabel;
    base.points = rule.destination.points !== null ? String(rule.destination.points) : "";
    base.cashPrizeAmount = rule.destination.cashPrizeAmount ?? "";
    base.cashPrizeCurrency = rule.destination.cashPrizeCurrency ?? "";
  }
  return base;
}

function matchLabel(m: AdminMatchListRow, roundFallback: string): string {
  const label = m.label ?? roundFallback.replace("{round}", String(m.round));
  return `${m.stageName} · ${m.containerName} · ${label} · ${m.entrantAName ?? "TBD"} vs ${m.entrantBName ?? "TBD"}`;
}

export function QualificationRuleDialog({
  tournamentId,
  rule,
  groupContainers,
  matches,
  open,
  onOpenChange,
}: {
  tournamentId: number;
  rule: AdminQualificationRule | null;
  groupContainers: AdminContainerOption[];
  matches: AdminMatchListRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.tournaments.qualifications");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<QualificationRuleFieldErrors>({});
  const [form, setForm] = useState<FormState>(() => emptyState(groupContainers.length > 0 ? "rank" : "match"));

  useEffect(() => {
    if (open) {
      setForm(rule ? stateFromRule(rule) : emptyState(groupContainers.length > 0 ? "rank" : "match"));
      setFieldErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    const input: QualificationRuleInput = {
      sourceKind: form.sourceKind,
      sourceContainerId: form.sourceContainerId,
      rankFrom: form.rankFrom,
      rankTo: form.rankTo,
      sourceMatchId: form.sourceMatchId,
      outcome: form.outcome,
      destinationKind: form.destinationKind,
      destinationContainerId: form.destinationContainer?.id ?? null,
      placement: form.placement,
      placementLabel: form.placementLabel,
      points: form.points,
      cashPrizeAmount: form.cashPrizeAmount,
      cashPrizeCurrency: form.cashPrizeCurrency,
    };

    startTransition(async () => {
      const result = rule ? await updateQualificationRule(rule.id, input) : await createQualificationRule(input);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("saveSuccess"));
    });
  }

  const err = (field: keyof QualificationRuleFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  const sourceKindItems = { rank: t("sourceKindRank"), match: t("sourceKindMatch") };
  const destinationKindItems = { container: t("destinationKindContainer"), placement: t("destinationKindPlacement") };
  const outcomeItems = { winner: t("outcomeWinner"), loser: t("outcomeLoser") };
  const groupContainerItems = Object.fromEntries(groupContainers.map((c) => [String(c.id), `${c.stageName} · ${c.name}`]));
  const matchItems = Object.fromEntries(matches.map((m) => [String(m.id), matchLabel(m, t.raw("matchLabelFallback"))]));

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t("edit.title") : t("create.title")}</DialogTitle>
          <DialogDescription>{rule ? t("edit.description") : t("create.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("sectionSource")}</h3>

            <FormField label={t("fieldSourceKind")} htmlFor="qr-source-kind" required>
              <Select items={sourceKindItems} value={form.sourceKind} onValueChange={(v) => v && set("sourceKind", v as FormState["sourceKind"])} disabled={!!rule}>
                <SelectTrigger id="qr-source-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rank">{t("sourceKindRank")}</SelectItem>
                  <SelectItem value="match">{t("sourceKindMatch")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {form.sourceKind === "rank" ? (
              <>
                {groupContainers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noContainersNotice")}</p>
                ) : (
                  <FormField label={t("fieldSourceContainer")} htmlFor="qr-source-container" required error={err("sourceContainerId")}>
                    <Select
                      items={groupContainerItems}
                      value={form.sourceContainerId !== null ? String(form.sourceContainerId) : undefined}
                      onValueChange={(v) => set("sourceContainerId", v ? Number(v) : null)}
                      disabled={!!rule}
                    >
                      <SelectTrigger id="qr-source-container" className="w-full" aria-invalid={!!fieldErrors.sourceContainerId}>
                        <SelectValue placeholder={t("fieldSourceContainerPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {groupContainers.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.stageName} · {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t("fieldRankFrom")} htmlFor="qr-rank-from" required error={err("rankFrom")}>
                    <Input id="qr-rank-from" type="number" min={1} value={form.rankFrom} onChange={(e) => set("rankFrom", e.target.value)} aria-invalid={!!fieldErrors.rankFrom} />
                  </FormField>
                  <FormField label={t("fieldRankTo")} htmlFor="qr-rank-to" required error={err("rankTo")}>
                    <Input id="qr-rank-to" type="number" min={1} value={form.rankTo} onChange={(e) => set("rankTo", e.target.value)} aria-invalid={!!fieldErrors.rankTo} />
                  </FormField>
                </div>
              </>
            ) : (
              <>
                {matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noMatchesNotice")}</p>
                ) : (
                  <FormField label={t("fieldSourceMatch")} htmlFor="qr-source-match" required error={err("sourceMatchId")}>
                    <Select
                      items={matchItems}
                      value={form.sourceMatchId !== null ? String(form.sourceMatchId) : undefined}
                      onValueChange={(v) => set("sourceMatchId", v ? Number(v) : null)}
                      disabled={!!rule}
                    >
                      <SelectTrigger id="qr-source-match" className="w-full" aria-invalid={!!fieldErrors.sourceMatchId}>
                        <SelectValue placeholder={t("fieldSourceMatchPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {matches.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {matchLabel(m, t.raw("matchLabelFallback"))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}

                <FormField label={t("fieldOutcome")} htmlFor="qr-outcome" required error={err("outcome")}>
                  <Select items={outcomeItems} value={form.outcome ?? undefined} onValueChange={(v) => set("outcome", (v as FormState["outcome"]) ?? null)}>
                    <SelectTrigger id="qr-outcome" className="w-full" aria-invalid={!!fieldErrors.outcome}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="winner">{t("outcomeWinner")}</SelectItem>
                      <SelectItem value="loser">{t("outcomeLoser")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("sectionDestination")}</h3>

            <FormField label={t("fieldDestinationKind")} htmlFor="qr-destination-kind" required>
              <Select items={destinationKindItems} value={form.destinationKind} onValueChange={(v) => v && set("destinationKind", v as FormState["destinationKind"])}>
                <SelectTrigger id="qr-destination-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="container">{t("destinationKindContainer")}</SelectItem>
                  <SelectItem value="placement">{t("destinationKindPlacement")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {form.destinationKind === "container" ? (
              <FormField label={t("fieldDestinationContainer")} htmlFor="qr-destination-container" required error={err("destinationContainerId")}>
                <QualificationContainerPicker
                  value={form.destinationContainer}
                  onChange={(c) => set("destinationContainer", c)}
                  placeholder={t("fieldDestinationContainerPlaceholder")}
                  searchPlaceholder={t("fieldDestinationContainerPlaceholder")}
                  noResultsLabel={t("noResultsLabel")}
                />
              </FormField>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t("fieldPlacement")} htmlFor="qr-placement" required error={err("placement")}>
                    <Input id="qr-placement" type="number" min={1} value={form.placement} onChange={(e) => set("placement", e.target.value)} aria-invalid={!!fieldErrors.placement} />
                  </FormField>
                  <FormField label={t("fieldPlacementLabel")} htmlFor="qr-placement-label" required error={err("placementLabel")}>
                    <Input
                      id="qr-placement-label"
                      value={form.placementLabel}
                      placeholder={t("fieldPlacementLabelPlaceholder")}
                      onChange={(e) => set("placementLabel", e.target.value)}
                      aria-invalid={!!fieldErrors.placementLabel}
                    />
                  </FormField>
                </div>

                <FormField label={t("fieldPoints")} htmlFor="qr-points" error={err("points")}>
                  <Input id="qr-points" type="number" min={0} value={form.points} onChange={(e) => set("points", e.target.value)} aria-invalid={!!fieldErrors.points} />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t("fieldCashPrizeAmount")} htmlFor="qr-cash-amount" error={err("cashPrizeAmount")}>
                    <Input id="qr-cash-amount" type="number" step="0.01" min={0} value={form.cashPrizeAmount} onChange={(e) => set("cashPrizeAmount", e.target.value)} aria-invalid={!!fieldErrors.cashPrizeAmount} />
                  </FormField>
                  <FormField label={t("fieldCashPrizeCurrency")} htmlFor="qr-cash-currency" error={err("cashPrizeCurrency")}>
                    <Input
                      id="qr-cash-currency"
                      maxLength={8}
                      placeholder={t("fieldCashPrizeCurrencyPlaceholder")}
                      value={form.cashPrizeCurrency}
                      onChange={(e) => set("cashPrizeCurrency", e.target.value)}
                      aria-invalid={!!fieldErrors.cashPrizeCurrency}
                    />
                  </FormField>
                </div>
              </>
            )}
          </div>

          {fieldErrors.general && <p className="text-sm text-destructive">{t(`error.${fieldErrors.general}`)}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
