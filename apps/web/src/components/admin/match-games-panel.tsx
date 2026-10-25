/**
 * GC-Stats - match-games-panel
 *
 * The games of a League of Legends series, shown where the maps panel sits
 * for Valorant. Each game can be added, edited or deleted by a tournament manager.
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LeagueGameDialog, type LeagueGameEntrant } from "@/components/admin/league-game-dialog";
import { deleteLeagueGame } from "@/actions/admin-lol-games";
import { mapCompletedBadgeClass } from "@/lib/status-colors";
import type { AdminLeagueGameRow } from "@/lib/admin-matches";
import { useGame } from "@/lib/use-game";

export type MatchGameView = AdminLeagueGameRow & { winnerName: string | null };

type PanelTranslations = ReturnType<typeof useTranslations>;

function GameRow({ game, canManage, onEdit, onDelete, t }: { game: MatchGameView; canManage: boolean; onEdit: () => void; onDelete: () => void; t: PanelTranslations }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{t("gameLabel", { order: game.order })}</div>
        <div className="text-xs text-muted-foreground">{game.winnerName ? t("winnerLabel", { name: game.winnerName }) : t("noWinner")}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {game.isForfeit && <span className="text-xs font-semibold text-destructive">{t("forfeit")}</span>}
        <Badge className={mapCompletedBadgeClass(game.isCompleted)}>{game.isCompleted ? t("finished") : t("notFinished")}</Badge>
        {canManage && (
          <>
            <Button variant="outline" size="sm" onClick={onEdit}>
              {t("editButton")}
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
              {t("deleteButton")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function MatchGamesPanel({
  tournamentId,
  matchId,
  games,
  entrants,
  canManage,
}: {
  tournamentId: number;
  matchId: number;
  games: MatchGameView[];
  entrants: LeagueGameEntrant[];
  canManage: boolean;
}) {
  const game = useGame();
  const t = useTranslations("admin.tournaments.matches.games");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MatchGameView | null>(null);
  const [deleting, setDeleting] = useState<MatchGameView | null>(null);

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteLeagueGame(game, tournamentId, matchId, target.id);
      if (!result.ok) {
        toast.error(t("deleteError"));
        return;
      }
      setDeleting(null);
      router.refresh();
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{t("heading")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        {canManage && <Button onClick={() => setCreating(true)}>{t("createButton")}</Button>}
      </CardHeader>
      <CardContent>
        {games.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {games.map((g) => (
              <GameRow key={g.id} game={g} canManage={canManage} onEdit={() => setEditing(g)} onDelete={() => setDeleting(g)} t={t} />
            ))}
          </div>
        )}
      </CardContent>

      <LeagueGameDialog
        tournamentId={tournamentId}
        matchId={matchId}
        entrants={entrants}
        editing={editing}
        nextOrder={games.length + 1}
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { order: deleting?.order ?? 0 })}
        confirmLabel={t("deleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </Card>
  );
}
