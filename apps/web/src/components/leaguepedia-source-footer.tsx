/**
 * GC-Stats - leaguepedia-source-footer
 *
 * Attribution at the bottom of a LoL page that shows data from games imported from Leaguepedia
 * (CC BY-SA asks for the source and a link to it). One link per game, to the wiki page it came from.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import type { LeaguepediaSourceGame } from "@/lib/match-page-data";

export async function LeaguepediaSourceFooter({ games }: { games: LeaguepediaSourceGame[] }) {
  if (games.length === 0) return null;
  const t = await getTranslations("leaguepediaSource");
  return (
    <p className="mx-auto mt-10 max-w-7xl px-4 pb-10 text-center text-xs text-neutral-500">
      {t("text")}{" "}
      {games.map((game, i) => (
        <Fragment key={game.order}>
          {i > 0 && ", "}
          <a href={game.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-neutral-400 underline-offset-2 transition-colors hover:text-[#e4ae22] hover:underline active:opacity-70">
            {t("game", { order: game.order })}
          </a>
        </Fragment>
      ))}
    </p>
  );
}
