/**
 * GC-Stats - player-games-card
 *
 * The games a person exists in: one shared identity, one profile per game. Lets an admin open
 * the profile of another game or add the person to it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { GAMES, GAME_INFO, type GameSlug } from "@gc-stats/db/game";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { withGame } from "@/lib/game-href";
import { addPlayerToGame } from "@/actions/admin-players";

export function PlayerGamesCard({ playerId, currentGame, games, canAdd }: { playerId: number; currentGame: GameSlug; games: GameSlug[]; canAdd: boolean }) {
  const t = useTranslations("admin.players.edit");
  const router = useRouter();
  const [pendingGame, setPendingGame] = useState<GameSlug | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(game: GameSlug) {
    setPendingGame(game);
    startTransition(async () => {
      const result = await addPlayerToGame(game, playerId);
      setPendingGame(null);
      if (!result.ok && result.error !== "alreadyThere") {
        toast.error(t(`gameAddError.${result.error}`));
        return;
      }
      toast.success(t("gameAddSuccess", { game: GAME_INFO[game].name }));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionGames")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t("gamesHint")}</p>
        {GAMES.map((game) => {
          const hasProfile = games.includes(game);
          return (
            <div key={game} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{GAME_INFO[game].name}</span>
                <span className="text-xs text-muted-foreground">{game === currentGame ? t("gameCurrent") : hasProfile ? t("gameHasProfile") : t("gameNoProfile")}</span>
              </div>
              {hasProfile && game !== currentGame && (
                <Button variant="outline" size="sm" render={<Link href={withGame(`/admin/players/${playerId}`, game)} />}>
                  {t("gameOpen")}
                </Button>
              )}
              {!hasProfile && canAdd && (
                <Button variant="outline" size="sm" onClick={() => handleAdd(game)} disabled={isPending}>
                  {pendingGame === game ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                  {pendingGame === game ? t("gameAdding") : t("gameAddButton", { game: GAME_INFO[game].shortName })}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
