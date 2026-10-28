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
import { Loader2Icon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormField } from "@/components/admin/form-field";
import { SearchablePicker } from "@/components/admin/searchable-picker";
import { addLeagueGame, updateLeagueGame, type LeagueGameFieldErrors, type LeagueGameInput } from "@/actions/admin-lol-games";
import { prepareLeaguepediaGameForMatch, refreshLeaguepediaGameList, type GameRef, type LeaguepediaPreview } from "@/actions/admin-leaguepedia";
import { isGameListOnCooldown } from "@/lib/leaguepedia-game-list-cooldown";
import { LeaguepediaGamePreview } from "@/components/admin/league-game-preview";
import type { AdminLeagueGameRow } from "@/lib/admin-matches";
import type { LeaguepediaGameOption } from "@/lib/admin-leaguepedia";
import { isTournamentRealmMatchId, riotCluster } from "@gc-stats/lol-stats-engine";
import { cn } from "@/lib/utils";
import { useGame } from "@/lib/use-game";

export type LeagueGameEntrant = { id: number; name: string };

/** The tournament's Leaguepedia link: whether a base page is set, and when the game list was last read (ISO). */
export type LeaguepediaLinkView = { linked: boolean; fetchedAt: string | null };

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

function stateFromGame(game: AdminLeagueGameRow, leaguepediaGames: LeaguepediaGameOption[]): FormState {
  const leaguepedia = game.source === "leaguepedia" && game.apiMatchId ? leaguepediaGames.find((g) => g.riotMatchId === game.apiMatchId) : undefined;
  return {
    order: String(game.order),
    apiMatchId: game.apiMatchId ?? "",
    winner: game.winnerEntrantId !== null ? String(game.winnerEntrantId) : NO_WINNER,
    isCompleted: game.isCompleted,
    isForfeit: game.isForfeit,
    note: game.note ?? "",
    leaguepediaGameId: leaguepedia?.leaguepediaGameId ?? NO_LEAGUEPEDIA,
  };
}

export function LeagueGameDialog({
  tournamentId,
  matchId,
  entrants,
  leaguepediaGames,
  leaguepediaLink,
  editing,
  nextOrder,
  open,
  onOpenChange,
}: {
  tournamentId: number;
  matchId: number;
  entrants: LeagueGameEntrant[];
  leaguepediaGames: LeaguepediaGameOption[];
  leaguepediaLink: LeaguepediaLinkView;
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
  // Its own transition, so the refresh shows its spinner and the save button does not.
  const [isRefreshing, startRefreshing] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<LeagueGameFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState(nextOrder));
  const [preview, setPreview] = useState<LeaguepediaPreview | null>(null);

  // Opening the dialog or switching game resets the form. A new game list (after a refresh) must not wipe what was typed.
  useEffect(() => {
    if (open) {
      setForm(editing ? stateFromGame(editing, leaguepediaGames) : emptyState(nextOrder));
      setFieldErrors({});
      setPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // A game already stored is greyed out, except the one being edited, which keeps its own Leaguepedia game.
    const stored = g.storedAs && g.storedAs.gameId !== editing?.id ? t(g.storedAs.matchId === matchId ? "leaguepedia.alreadyStoredHere" : "leaguepedia.alreadyStoredElsewhere", { order: g.storedAs.order }) : "";
    return [`${g.team1 ?? "?"} vs ${g.team2 ?? "?"}`, t("leaguepedia.gameNumber", { number: g.gameInMatch }), date, g.hasData ? "" : t("leaguepedia.noData"), stored].filter(Boolean).join(" · ");
  };
  const leaguepediaOptions = orderedLeaguepediaGames.map((g) => ({
    id: g.leaguepediaGameId,
    label: leaguepediaLabel(g),
    disabled: !g.hasData || (g.storedAs !== null && g.storedAs.gameId !== editing?.id),
  }));
  const selectedLeaguepedia = leaguepediaGames.find((g) => g.leaguepediaGameId === form.leaguepediaGameId) ?? null;
  const fetchSource = selectedLeaguepedia?.hasData ? "leaguepedia" : form.leaguepediaGameId === NO_LEAGUEPEDIA && riotCluster(form.apiMatchId) !== null ? "riot" : null;
  const onCooldown = isGameListOnCooldown(leaguepediaLink.fetchedAt);

  function selectLeaguepediaGame(id: string) {
    const picked = leaguepediaGames.find((g) => g.leaguepediaGameId === id);
    // Picking a game sets its Riot match id, as the field below would.
    setForm((prev) => ({ ...prev, leaguepediaGameId: id, apiMatchId: picked?.riotMatchId ?? prev.apiMatchId }));
  }

  // Reads the game list again. The server refuses a read inside the cooldown too, so this only saves the round trip.
  function handleRefreshGames() {
    if (onCooldown || isRefreshing) return;
    startRefreshing(async () => {
      const result = await refreshLeaguepediaGameList(tournamentId);
      if (!result.ok) {
        toast.error(t("leaguepedia.refreshError"));
        return;
      }
      router.refresh();
      toast.success(t("leaguepedia.refreshed", { count: result.games }));
    });
  }

  const refreshBlocked = onCooldown || isRefreshing;
  const refreshGamesButton = (
    <Button variant="outline" size="sm" aria-disabled={refreshBlocked} onClick={handleRefreshGames} className={cn(refreshBlocked && "cursor-not-allowed opacity-50")}>
      {isRefreshing ? <Loader2Icon className="animate-spin" /> : null}
      {isRefreshing ? t("leaguepedia.fetching") : t("leaguepedia.refreshGames")}
    </Button>
  );

  // The picked Leaguepedia game, or else the Riot match id typed in the field below.
  const gameRef: GameRef =
    form.leaguepediaGameId === NO_LEAGUEPEDIA ? { source: "riot", riotMatchId: form.apiMatchId } : { source: "leaguepedia", leaguepediaGameId: form.leaguepediaGameId };

  // Loads the game for the preview. Nothing is stored yet: the admin checks the players and sides first.
  function handlePrepare(mode: "fetch" | "renew" | "reprocess") {
    startTransition(async () => {
      const result = await prepareLeaguepediaGameForMatch(tournamentId, matchId, { game: gameRef, mode });
      if (!result.ok) {
        toast.error(
          t(`leaguepedia.error.${result.error.kind}`, {
            count: result.error.kind === "missingPlayers" ? result.error.count : 0,
            ids: result.error.kind === "unknownChampions" ? result.error.ids.join(", ") : "",
          })
        );
        return;
      }
      setPreview(result.preview);
    });
  }

  if (preview) {
    return (
      <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("leaguepedia.previewTitle")}</DialogTitle>
            <DialogDescription>{t("leaguepedia.previewDescription")}</DialogDescription>
          </DialogHeader>
          <LeaguepediaGamePreview
            tournamentId={tournamentId}
            matchId={matchId}
            gameId={editing?.id ?? null}
            game={gameRef}
            order={Number(form.order)}
            preview={preview}
            onBack={() => setPreview(null)}
            onSaved={() => onOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    );
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
            <SearchablePicker
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

          {form.leaguepediaGameId === NO_LEAGUEPEDIA && leaguepediaLink.linked && (
            <div>
              {onCooldown ? (
                <Tooltip>
                  <TooltipTrigger render={refreshGamesButton} />
                  <TooltipContent>{t("leaguepedia.refreshCooldown")}</TooltipContent>
                </Tooltip>
              ) : (
                refreshGamesButton
              )}
            </div>
          )}

          <FormField label={t("fieldApiMatchId")} htmlFor="game-api-match-id" hint={t("fieldApiMatchIdHint")} error={fieldErr("apiMatchId")}>
            <Input id="game-api-match-id" className="font-mono text-xs" value={form.apiMatchId} onChange={(e) => set("apiMatchId", e.target.value)} aria-invalid={!!fieldErrors.apiMatchId} />
          </FormField>

          {fetchSource !== null && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handlePrepare("fetch")} disabled={isPending}>
                {isPending ? t("leaguepedia.fetching") : t(fetchSource === "riot" ? "leaguepedia.riotFetch" : "leaguepedia.fetch")}
              </Button>
              <Button variant="outline" onClick={() => handlePrepare("renew")} disabled={isPending}>
                {t("leaguepedia.renew")}
              </Button>
              <Button variant="outline" onClick={() => handlePrepare("reprocess")} disabled={isPending}>
                {t("leaguepedia.reprocess")}
              </Button>
            </div>
          )}
          {form.leaguepediaGameId === NO_LEAGUEPEDIA && isTournamentRealmMatchId(form.apiMatchId) && (
            <p className="text-xs text-muted-foreground">{t("leaguepedia.riotTournamentRealm")}</p>
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
