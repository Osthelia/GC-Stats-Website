/**
 * GC-Stats - match-score-backfill-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { backfillMatchScoresFromMaps, type ScoreBackfillReport, type ScoreBackfillSample } from "@/actions/admin-match-score-backfill";

export function MatchScoreBackfillCard({ tournamentId }: { tournamentId: number }) {
  const t = useTranslations("admin.tournaments.scoreBackfill");
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<ScoreBackfillReport | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function run(apply: boolean) {
    startTransition(async () => {
      try {
        const result = await backfillMatchScoresFromMaps(tournamentId, apply);
        if (apply) {
          toast.success(t("applySuccess", { count: result.resolvable }));
          setConfirmOpen(false);
          // Re-preview so what's left (undecided/conflicts) stays visible.
          setReport(await backfillMatchScoresFromMaps(tournamentId, false));
        } else {
          setReport(result);
        }
      } catch {
        toast.error(t("error"));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => run(false)} disabled={isPending}>
            {isPending && !confirmOpen ? t("previewing") : t("previewButton")}
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={isPending || !report || report.resolvable === 0}>
            {t("applyButton", { count: report?.resolvable ?? 0 })}
          </Button>
        </div>

        {report && (
          <div className="flex flex-col gap-3 text-sm">
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              <li>{t("resolvable", { count: report.resolvable })}</li>
              <li className="text-muted-foreground">{t("undecided", { count: report.undecided })}</li>
              <li className={report.conflicts > 0 ? "text-destructive" : "text-muted-foreground"}>{t("conflicts", { count: report.conflicts })}</li>
            </ul>
            <SampleList tournamentId={tournamentId} title={t("sampleTitle")} rows={report.sample} />
            <SampleList tournamentId={tournamentId} title={t("conflictSampleTitle")} rows={report.conflictSample} />
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("confirmTitle")}
          description={t("confirmDescription", { count: report?.resolvable ?? 0 })}
          confirmLabel={t("confirmButton")}
          cancelLabel={t("cancel")}
          onConfirm={() => run(true)}
          isPending={isPending}
        />
      </CardContent>
    </Card>
  );
}

function SampleList({ tournamentId, title, rows }: { tournamentId: number; title: string; rows: ScoreBackfillSample[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <li key={r.matchId}>
            <Link href={`/admin/tournaments/${tournamentId}/matches/${r.matchId}`} className="hover:underline">
              #{r.matchId}
            </Link>{" "}
            <span className="font-mono text-muted-foreground">
              {r.scoreA} - {r.scoreB}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
