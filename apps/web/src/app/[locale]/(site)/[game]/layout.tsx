/**
 * GC-Stats - layout
 *
 * The game segment of the public pages: anything that is not a game is a 404, and so is a game that is not
 * public yet (`PUBLIC_GAMES`) unless the viewer is an admin of it, who gets a noindex preview with a banner.
 * The game is provided to the client components below.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GAME_INFO } from "@gc-stats/db/game";
import { gameFromParams } from "@/lib/game";
import { canViewGame, isGamePreview } from "@/lib/rbac";
import { GameScope } from "@/lib/use-game";

type Props = { children: React.ReactNode; params: Promise<{ game: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const game = await gameFromParams(params);
  return (await isGamePreview(game)) ? { robots: { index: false, follow: false } } : {};
}

export default async function GameLayout({ children, params }: Props) {
  const game = await gameFromParams(params);
  if (!(await canViewGame(game))) notFound();

  const preview = await isGamePreview(game);
  const t = preview ? await getTranslations("game") : null;
  return (
    <GameScope game={game}>
      {t && (
        <div role="status" className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-700 dark:text-amber-300">
          {t("previewBanner", { game: GAME_INFO[game].name })}
        </div>
      )}
      {children}
    </GameScope>
  );
}
