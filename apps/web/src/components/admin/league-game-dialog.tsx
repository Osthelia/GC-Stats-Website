/**
 * GC-Stats - league-game-dialog
 *
 * Adds or edits one game of a League of Legends series.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { LeaguepediaGamePicker } from "@/components/admin/leaguepedia-game-picker";
import { addLeagueGame, updateLeagueGame, type LeagueGameFieldErrors, type LeagueGameInput } from "@/actions/admin-lol-games";
import { fetchLeaguepediaGameForMatch } from "@/actions/admin-leaguepedia";
import type { AdminLeagueGameRow } from "@/lib/admin-matches";
import type { LeaguepediaGameOption } from "@/lib/admin-leaguepedia";
import { useGame } from "@/lib/use-game";

export type LeagueGameEntrant = { id: number; name: string };

const NO_WINNER = "none";
const NO_LEAGUEPEDIA = "none";

type FormState = {
  order: string;
  apiMatchId: string;
  winner: string;
  isCompleted: boolean;
  isForfeit: boolean;
  note: string;
  leaguepediaGameId: string;
};

function emptyState(nextOrder: number): FormState {
  return { order: String(nextOrder), apiMatchId: "", winner: NO_WINNER, isCompleted: false, isForfeit: false, note: "", leaguepediaGameId: NO_LEAGUEPEDIA };
}

function stateFromGame(game: AdminLeagueGameRow): FormState {
  return {
    order: String(game.order),
    apiMatchId: game.apiMatchId ?? "",
    winner: game.winnerEntrantId !== null ? String(game.winnerEntrantId) : NO_WINNER,
    isCompleted: game.isCompleted,
    isForfeit: game.isForfeit,
    note: game.note ?? "",
    leaguepediaGameId: NO_LEAGUEPEDIA,
  };
}

export function LeagueGameDialog({
  tournamentId,
  matchId,
  entrants,
  leaguepediaGames,
  editing,
  nextOrder,
  open,
  onOpenChange,
}: {
  tournamentId: number;
  matchId: number;
  entrants: LeagueGameEntrant[];
  leaguepediaGames: LeaguepediaGameOption[];
  editing: AdminLeagueGameRow | null;
  nextOrder: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const game = useGame();
  const locale = useLocale();
  const t = useTranslations("admin.tournaments.matches.games");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<LeagueGameFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState(nextOrder));

  useEffect(() => {
    if (open) {
      setForm(editing ? stateFromGame(editing) : emptyState(nextOrder));
      setFieldErrors({});
    }
  }, [open, editing, nextOrder]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const fieldErr = (field: keyof LeagueGameFieldErrors) => (fieldErrors[field] ? t(`fieldError.${fieldErrors[field]}`) : undefined);

  const winnerItems: Record<string, string> = { [NO_WINNER]: t("fieldWinnerNone"), ...Object.fromEntries(entrants.map((e) => [String(e.id), e.name])) };

  // Games between the two entrants of this series come first; the rest of the list follows, so a naming difference never hides a game.
  const entrantNames = new Set(entrants.map((e) => e.name.trim().toLowerCase()));
  const isSeriesGame = (g: LeaguepediaGameOption) => entrantNames.has((g.team1 ?? "").trim().toLowerCase()) && entrantNames.has((g.team2 ?? "").trim().toLowerCase());
  const orderedLeaguepediaGames = [...leaguepediaGames].sort((a, b) => Number(isSeriesGame(b)) - Number(isSeriesGame(a)));
  const leaguepediaLabel = (g: LeaguepediaGameOption) => {
    const date = g.playedAt ? new Date(g.playedAt).toLocaleDateString(locale) : "";
    return [`${g.team1 ?? "?"} vs ${g.team2 ?? "?"}`, t("leaguepedia.gameNumber", { number: g.gameInMatch }), date, g.hasData ? "" : t("leaguepedia.noData")].filter(Boolean).join(" · ");
  };
  const leaguepediaOptions = orderedLeaguepediaGames.map((g) => ({ id: g.leaguepediaGameId, label: leaguepediaLabel(g), disabled: !g.hasData }));
  const selectedLeaguepedia = leaguepediaGames.find((g) => g.leaguepediaGameId === form.leaguepediaGameId) ?? null;

  function selectLeaguepediaGame(id: string) {
    const picked = leaguepediaGames.find((g) => g.leaguepediaGameId === id);
    // Picking a game sets its Riot match id, as the field below would.
    setForm((prev) => ({ ...prev, leaguepediaGameId: id, apiMatchId: picked?.riotMatchId ?? prev.apiMatchId }));
  }

  function handleLeaguepedia(mode: "fetch" | "renew" | "reprocess") {
    startTransition(async () => {
      const result = await fetchLeaguepediaGameForMatch(tournamentId, matchId, { leaguepediaGameId: form.leaguepediaGameId, order: Number(form.order), mode });
      if (!result.ok) {
        toast.error(t(`leaguepedia.error.${result.error.kind}`, { count: result.error.kind === "missingPlayers" ? result.error.count : 0 }));
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("leaguepedia.success"));
    });
  }

  function handleSave() {
    setFieldErrors({});
    const input: LeagueGameInput = {
      order: form.order,
      apiMatchId: form.apiMatchId,
      winnerEntrantId: form.winner === NO_WINNER ? "" : form.winner,
      isCompleted: form.isCompleted,
      isForfeit: form.isForfeit,
      note: form.note,
    };
    startTransition(async () => {
      const result = editing ? await updateLeagueGame(game, tournamentId, matchId, editing.id, input) : await addLeagueGame(game, tournamentId, matchId, input);
      if (!result.ok) {
        if ("fieldErrors" in result) setFieldErrors(result.fieldErrors);
        toast.error(t("saveError"));
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("saveSuccess"));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldOrder")} htmlFor="game-order" required error={fieldErr("order")}>
              <Input id="game-order" type="number" min={1} value={form.order} onChange={(e) => set("order", e.target.value)} aria-invalid={!!fieldErrors.order} />
            </FormField>
            <FormField label={t("fieldWinner")} htmlFor="game-winner" error={fieldErr("winnerEntrantId") ?? fieldErr("isCompleted")}>
              <Select items={winnerItems} value={form.winner} onValueChange={(v) => set("winner", v as string)}>
                <SelectTrigger id="game-winner" className="w-full" aria-invalid={!!fieldErrors.winnerEntrantId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_WINNER}>{t("fieldWinnerNone")}</SelectItem>
                  {entrants.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label={t("leaguepedia.label")} htmlFor="game-leaguepedia">
            <LeaguepediaGamePicker
              id="game-leaguepedia"
              value={form.leaguepediaGameId === NO_LEAGUEPEDIA ? null : form.leaguepediaGameId}
              options={leaguepediaOptions}
              onChange={(id) => selectLeaguepediaGame(id ?? NO_LEAGUEPEDIA)}
              placeholder={t("leaguepedia.none")}
              noneLabel={t("leaguepedia.none")}
              searchPlaceholder={t("leaguepedia.searchPlaceholder")}
              noResultsLabel={t("leaguepedia.noResults")}
            />
          </FormField>

          <FormField label={t("fieldApiMatchId")} htmlFor="game-api-match-id" hint={t("fieldApiMatchIdHint")} error={fieldErr("apiMatchId")}>
            <Input id="game-api-match-id" className="font-mono text-xs" value={form.apiMatchId} onChange={(e) => set("apiMatchId", e.target.value)} aria-invalid={!!fieldErrors.apiMatchId} />
          </FormField>

          {selectedLeaguepedia?.hasData && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleLeaguepedia("fetch")} disabled={isPending}>
                {isPending ? t("leaguepedia.fetching") : t("leaguepedia.fetch")}
              </Button>
              <Button variant="outline" onClick={() => handleLeaguepedia("renew")} disabled={isPending}>
                {t("leaguepedia.renew")}
              </Button>
              <Button variant="outline" onClick={() => handleLeaguepedia("reprocess")} disabled={isPending}>
                {t("leaguepedia.reprocess")}
              </Button>
            </div>
          )}

          <FormField label={t("fieldNote")} htmlFor="game-note" error={fieldErr("note")}>
            <Input id="game-note" maxLength={500} value={form.note} onChange={(e) => set("note", e.target.value)} aria-invalid={!!fieldErrors.note} />
          </FormField>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.isCompleted} onCheckedChange={(c) => set("isCompleted", c === true)} />
              {t("fieldCompleted")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isForfeit}
                onCheckedChange={(c) => setForm((prev) => ({ ...prev, isForfeit: c === true, isCompleted: c === true ? true : prev.isCompleted }))}
              />
              {t("fieldForfeit")}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
