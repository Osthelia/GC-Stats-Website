"use client";

/**
 * GC-Stats - game-switcher
 *
 * Valorant / League of Legends switch of the header. Keeps the visitor on
 * the same listing (tournaments, matches, news) when there is one, else
 * opens the home of the other game, since team, player and match ids do not
 * exist across games.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { GAMES, type GameSlug } from "@gc-stats/db/game";
import { GameSwitchTabs } from "@/components/game-switch-tabs";
import { usePathname } from "@/i18n/navigation";
import { useRouteGame } from "@/lib/use-game";
import { cn } from "@/lib/utils";

const KEPT_LISTINGS = ["tournaments", "match", "news"];

function targetFor(pathname: string, game: GameSlug): string {
  const segments = pathname.split("/").filter(Boolean);
  const listing = segments[1];
  return segments.length === 2 && listing && KEPT_LISTINGS.includes(listing) ? `/${game}/${listing}` : `/${game}`;
}

export function GameSwitcher({ className }: { className?: string }) {
  const t = useTranslations("game");
  const pathname = usePathname();
  const current = useRouteGame();

  return (
    <GameSwitchTabs
      items={GAMES.map((game) => ({ game, href: targetFor(pathname, game), label: t(game) }))}
      current={current}
      groupLabel={t("switcherLabel")}
      className={cn("flex-none", className)}
    />
  );
}
