/**
 * GC-Stats - player-other-games
 *
 * Links from a player page to the same person's profile in the other games.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { GAME_INFO, type GameSlug } from "@gc-stats/db/game";
import { Link } from "@/i18n/navigation";
import { withGame } from "@/lib/game-href";

export async function PlayerOtherGames({ games, segment }: { games: GameSlug[]; segment: string }) {
  if (games.length === 0) return null;
  const t = await getTranslations("playerPage");

  return (
    <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-6 pt-4 text-[13px] text-neutral-400">
      {games.map((game) => (
        <Link
          key={game}
          href={withGame(`/player/${segment}`, game)}
          className="rounded-full border border-neutral-700 px-3 py-1 font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-50 active:scale-[0.97]"
        >
          {t("alsoOn", { game: GAME_INFO[game].name })}
        </Link>
      ))}
    </div>
  );
}
