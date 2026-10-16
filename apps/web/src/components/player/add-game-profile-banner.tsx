/**
 * GC-Stats - add-game-profile-banner
 *
 * Shown on a player page to the account linked to that person when the person has no profile in
 * another game yet: one click creates it, the identity is reused.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { GAME_INFO, type GameSlug } from "@gc-stats/db/game";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { withGame } from "@/lib/game-href";
import { getMyMissingGameProfiles, addMyGameProfile } from "@/actions/person-games";

export function AddGameProfileBanner({ personId, segment }: { personId: number; segment: string }) {
  const t = useTranslations("playerPage.addGameProfile");
  const { status } = useSession();
  const [missing, setMissing] = useState<GameSlug[]>([]);
  const [added, setAdded] = useState<GameSlug[]>([]);
  const [pendingGame, setPendingGame] = useState<GameSlug | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    getMyMissingGameProfiles(personId).then((games) => {
      if (!cancelled) setMissing(games);
    });
    return () => {
      cancelled = true;
    };
  }, [status, personId]);

  if (missing.length === 0 && added.length === 0) return null;

  function handleAdd(game: GameSlug) {
    setPendingGame(game);
    startTransition(async () => {
      const result = await addMyGameProfile(game, personId);
      setPendingGame(null);
      if (!result.ok && result.error !== "alreadyThere") {
        toast.error(t(`error.${result.error}`));
        return;
      }
      setMissing((current) => current.filter((g) => g !== game));
      setAdded((current) => [...current, game]);
      toast.success(t("done", { game: GAME_INFO[game].name }));
    });
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 pt-6">
      {missing.map((game) => (
        <div key={game} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 px-5 py-4" style={{ background: "var(--gcs-surface-3)" }}>
          <div className="min-w-0">
            <p className="text-[14.5px] font-semibold text-neutral-50">{t("title", { game: GAME_INFO[game].name })}</p>
            <p className="text-[13px] text-neutral-400">{t("description", { game: GAME_INFO[game].name })}</p>
          </div>
          <Button onClick={() => handleAdd(game)} disabled={isPending}>
            {pendingGame === game ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            {pendingGame === game ? t("adding") : t("button", { game: GAME_INFO[game].name })}
          </Button>
        </div>
      ))}
      {added.map((game) => (
        <div key={game} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 px-5 py-4" style={{ background: "var(--gcs-surface-3)" }}>
          <p className="text-[14.5px] text-neutral-200">{t("done", { game: GAME_INFO[game].name })}</p>
          <Button variant="outline" render={<Link href={withGame(`/player/${segment}`, game)} />}>
            {t("open", { game: GAME_INFO[game].name })}
          </Button>
        </div>
      ))}
    </div>
  );
}
