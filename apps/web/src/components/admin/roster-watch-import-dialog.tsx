/**
 * GC-Stats - roster-watch-import-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { TournamentPicker } from "@/components/admin/tournament-picker";
import { importTournamentAccounts, listTournamentStagesForRosterWatch, searchTournamentsForRosterWatch } from "@/actions/admin-roster-watch";

const ALL_STAGES = "all";

/** Follows the X account of every team of a tournament (or of one of its stages). */
export function RosterWatchImportDialog() {
  const t = useTranslations("admin.rosterWatch.import");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tournament, setTournament] = useState<{ id: number; name: string } | null>(null);
  const [stageOptions, setStageOptions] = useState<{ id: number; name: string }[]>([]);
  const [stageId, setStageId] = useState(ALL_STAGES);
  const [loadingStages, setLoadingStages] = useState(false);
  const [errors, setErrors] = useState<{ tournament?: string; stage?: string }>({});
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTournament(null);
    setStageOptions([]);
    setStageId(ALL_STAGES);
    setErrors({});
  }, [open]);

  function handleTournamentChange(next: { id: number; name: string } | null) {
    setTournament(next);
    setStageId(ALL_STAGES);
    setStageOptions([]);
    setErrors({});
    if (!next) return;
    const current = ++requestId.current;
    setLoadingStages(true);
    listTournamentStagesForRosterWatch(next.id)
      .then((rows) => {
        if (current === requestId.current) setStageOptions(rows);
      })
      .finally(() => {
        if (current === requestId.current) setLoadingStages(false);
      });
  }

  function handleImport() {
    setErrors({});
    startTransition(async () => {
      const result = await importTournamentAccounts({ tournamentId: tournament?.id ?? null, stageId: stageId === ALL_STAGES ? null : Number(stageId) });
      if (!result.ok) {
        setErrors({ [result.field]: t(`error.${result.error}`) });
        return;
      }
      setOpen(false);
      router.refresh();
      toast.success(t("success", { added: result.added, alreadyFollowed: result.alreadyFollowed, noTwitter: result.noTwitter, invalid: result.invalid }));
    });
  }

  const stageItems = { [ALL_STAGES]: t("allStages"), ...Object.fromEntries(stageOptions.map((stage) => [String(stage.id), stage.name])) };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Download />
        {t("button")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FormField label={t("tournament")} htmlFor="rw-import-tournament" required error={errors.tournament}>
            <TournamentPicker
              id="rw-import-tournament"
              value={tournament}
              onChange={handleTournamentChange}
              placeholder={t("tournamentPlaceholder")}
              searchPlaceholder={t("tournamentSearch")}
              noResultsLabel={t("tournamentNoResults")}
              search={searchTournamentsForRosterWatch}
            />
          </FormField>

          <FormField label={t("stage")} htmlFor="rw-import-stage" required error={errors.stage}>
            <Select items={stageItems} value={stageId} onValueChange={(v) => setStageId(v ?? ALL_STAGES)} disabled={!tournament || loadingStages}>
              <SelectTrigger id="rw-import-stage" className="w-full" aria-invalid={!!errors.stage}>
                {loadingStages ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STAGES}>{t("allStages")}</SelectItem>
                {stageOptions.map((stage) => (
                  <SelectItem key={stage.id} value={String(stage.id)}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleImport} disabled={isPending || !tournament || loadingStages}>
            {isPending ? <Loader2 className="animate-spin" /> : <Download />}
            {isPending ? t("importing") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
