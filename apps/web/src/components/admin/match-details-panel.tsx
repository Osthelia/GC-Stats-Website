/**
 * GC-Stats - match-details-panel
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
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/admin/form-field";
import { updateMatchDetails, reportMatchResult, saveMatchLiveScore, type MatchDetailsFieldErrors, type ReportResultFieldErrors } from "@/actions/admin-matches";
import { matchStatusBadgeClass } from "@/lib/status-colors";
import type { AdminMatchDetail } from "@/lib/admin-matches";

const ENTRANT_NONE = "none";
const STATUS_VALUES = ["pending", "live"] as const;
const BEST_OF_VALUES = ["1", "3", "5", "7"] as const;
type StatusValue = (typeof STATUS_VALUES)[number] | "completed";

/**
 * Single form for both the match's fields and its result — mirrors V1's
 * `admin/matches/_form.blade.php`, a single grid with the score fields
 * inline (V1 shows them whenever `isset($match)`, which is always true
 * here — this page never handles match *creation*). Where V1 derives the
 * winner purely from score comparison (`Matchs::getResultForTeam()`), this
 * does the same instead of asking for an explicit winner field, then calls
 * the same `resolveMatch` (Phase 2) used everywhere else so bracket
 * auto-progression still fires.
 */
export function MatchForm({
  match,
  entrants,
  canManage,
}: {
  match: AdminMatchDetail;
  entrants: { id: number; displayName: string }[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.tournaments.matches");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [detailsErrors, setDetailsErrors] = useState<MatchDetailsFieldErrors>({});
  const [resultErrors, setResultErrors] = useState<ReportResultFieldErrors>({});

  const locked = match.status === "completed";

  const [entrantAId, setEntrantAId] = useState(match.entrantAId !== null ? String(match.entrantAId) : ENTRANT_NONE);
  const [entrantBId, setEntrantBId] = useState(match.entrantBId !== null ? String(match.entrantBId) : ENTRANT_NONE);
  const [status, setStatus] = useState<StatusValue>(match.status);
  // "completed" is never offered as a manual target (must go through result
  // reporting) but stays selectable if that's already the current value, so
  // saving other fields (patch, best of...) doesn't silently un-complete it.
  const statusOptions: StatusValue[] = match.status === "completed" ? ["completed", ...STATUS_VALUES] : [...STATUS_VALUES];
  const [scheduledAt, setScheduledAt] = useState<string | null>(match.scheduledAt);
  const [bestOf, setBestOf] = useState(String(match.bestOf));
  const [patch, setPatch] = useState(match.patch ?? "");
  const [label, setLabel] = useState(match.label ?? "");
  const [scoreA, setScoreA] = useState(match.scoreA !== null ? String(match.scoreA) : "");
  const [scoreB, setScoreB] = useState(match.scoreB !== null ? String(match.scoreB) : "");

  const bothEntrantsSet = entrantAId !== ENTRANT_NONE && entrantBId !== ENTRANT_NONE;
  const scoresDisabled = locked || !canManage || !bothEntrantsSet;

  const detailsErr = (field: keyof MatchDetailsFieldErrors) => (detailsErrors[field] ? t(`detailsError.${detailsErrors[field]}`) : undefined);
  const resultErr = (field: keyof ReportResultFieldErrors) => (resultErrors[field] ? t(`resultError.${resultErrors[field]}`) : undefined);

  function handleSave() {
    setDetailsErrors({});
    setResultErrors({});
    startTransition(async () => {
      const detailsResult = await updateMatchDetails(match.id, {
        entrantAId: entrantAId === ENTRANT_NONE ? null : Number(entrantAId),
        entrantBId: entrantBId === ENTRANT_NONE ? null : Number(entrantBId),
        status,
        scheduledAt,
        bestOf,
        patch,
        label,
      });
      if (!detailsResult.ok) {
        setDetailsErrors(detailsResult.fieldErrors);
        return;
      }

      const scoreAFilled = scoreA.trim() !== "";
      const scoreBFilled = scoreB.trim() !== "";
      if (!locked && bothEntrantsSet && (scoreAFilled || scoreBFilled)) {
        if (!scoreAFilled || !scoreBFilled) {
          setResultErrors({ score: "invalid" });
          return;
        }
        const a = Number(scoreA);
        const b = Number(scoreB);
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < -1 || b < -1) {
          setResultErrors({ score: "invalid" });
          return;
        }
        // -1 is the forfeit sentinel (no boolean field, mirrors V1's
        // Matchs/GameMap score columns) — whichever side has it lost by
        // forfeit, the other side wins regardless of its own score.
        if (a === -1 && b === -1) {
          setResultErrors({ score: "bothCannotForfeit" });
          return;
        }
        // Only a decided series is reported as a result (completes the match
        // and propagates it). Anything else, 1-1 in a BO3, 0-0, is just the
        // running score and leaves the match open. BO1 scores are rounds.
        const winsNeeded = Number(bestOf) === 1 ? 13 : Math.ceil(Number(bestOf) / 2);
        const decided = a === -1 || b === -1 || (a !== b && Math.max(a, b) >= winsNeeded);
        const resultResult = decided
          ? await reportMatchResult(match.id, { winnerId: a === -1 || (b !== -1 && b > a) ? Number(entrantBId) : Number(entrantAId), scoreA, scoreB })
          : await saveMatchLiveScore(match.id, { scoreA, scoreB });
        if (!resultResult.ok) {
          setResultErrors(resultResult.fieldErrors);
          return;
        }
      }

      router.refresh();
      toast.success(t("detailsSaveSuccess"));
    });
  }

  const entrantItems: Record<string, string> = { [ENTRANT_NONE]: t("entrantNone"), ...Object.fromEntries(entrants.map((e) => [String(e.id), e.displayName])) };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {t("detailsHeading")}
          <Badge className={matchStatusBadgeClass(match.status)}>{t(`status.${match.status}`)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {locked && <p className="rounded-md border bg-amber-500/10 px-4 py-3 text-sm text-amber-500">{t("completedLockedNotice")}</p>}
        {(resultErr("winnerId") || resultErr("matchId")) && (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {resultErr("winnerId") ?? resultErr("matchId")}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label={t("fieldEntrantA")} htmlFor="m-entrant-a" error={detailsErr("entrantAId")}>
            <Select items={entrantItems} value={entrantAId} onValueChange={(v) => v && setEntrantAId(v)}>
              <SelectTrigger id="m-entrant-a" className="w-full" disabled={locked || !canManage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ENTRANT_NONE}>{t("entrantNone")}</SelectItem>
                {entrants.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("fieldEntrantB")} htmlFor="m-entrant-b" error={detailsErr("entrantBId")}>
            <Select items={entrantItems} value={entrantBId} onValueChange={(v) => v && setEntrantBId(v)}>
              <SelectTrigger id="m-entrant-b" className="w-full" disabled={locked || !canManage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ENTRANT_NONE}>{t("entrantNone")}</SelectItem>
                {entrants.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("fieldStatus")} htmlFor="m-status" required error={detailsErr("status")}>
            <Select items={Object.fromEntries(statusOptions.map((v) => [v, t(`status.${v}`)]))} value={status} onValueChange={(v) => v && setStatus(v as StatusValue)}>
              <SelectTrigger id="m-status" className="w-full" disabled={!canManage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`status.${v}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("fieldBestOf")} htmlFor="m-best-of" required error={detailsErr("bestOf")}>
            <Select items={Object.fromEntries(BEST_OF_VALUES.map((v) => [v, `BO${v}`]))} value={bestOf} onValueChange={(v) => v && setBestOf(v)}>
              <SelectTrigger id="m-best-of" className="w-full" disabled={!canManage}>
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

          <FormField
            label={t("fieldScoreA")}
            htmlFor="m-score-a"
            error={resultErr("score")}
            hint={!bothEntrantsSet ? t("resultNeedsBothEntrants") : t("scoreForfeitHint")}
          >
            <Input id="m-score-a" type="number" min={-1} value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={scoresDisabled} aria-invalid={!!resultErrors.score} />
          </FormField>
          <FormField label={t("fieldScoreB")} htmlFor="m-score-b" error={resultErr("score")}>
            <Input id="m-score-b" type="number" min={-1} value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={scoresDisabled} aria-invalid={!!resultErrors.score} />
          </FormField>

          <div className="md:col-span-2">
            <FormField label={t("fieldScheduledAt")} htmlFor="m-scheduled-at" error={detailsErr("scheduledAt")}>
              <DateTimeInput id="m-scheduled-at" value={scheduledAt} onChange={setScheduledAt} disabled={!canManage} aria-invalid={!!detailsErrors.scheduledAt} />
            </FormField>
          </div>

          <FormField label={t("fieldPatch")} htmlFor="m-patch" error={detailsErr("patch")}>
            <Input id="m-patch" placeholder="9.03" value={patch} onChange={(e) => setPatch(e.target.value)} disabled={!canManage} aria-invalid={!!detailsErrors.patch} />
          </FormField>
          <FormField label={t("fieldLabel")} htmlFor="m-label" error={detailsErr("label")}>
            <Input id="m-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={!canManage} aria-invalid={!!detailsErrors.label} />
          </FormField>
        </div>

        {canManage && (
          <div>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
