"use client";

/**
 * GC-Stats - admin-game-switcher
 *
 * Valorant / League of Legends switch of the admin dashboard (/admin/{game}).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import type { GameSlug } from "@gc-stats/db/game";
import { GameSwitchTabs } from "@/components/game-switch-tabs";
import { useRouteGame } from "@/lib/use-game";

/**
 * `games` are the games the viewer can administer
 * `publicGames` are the games visitors can see.
 */
export function AdminGameSwitcher({ games, publicGames }: { games: readonly GameSlug[]; publicGames: readonly GameSlug[] }) {
  const t = useTranslations("game");
  const current = useRouteGame();

  if (games.length < 2) return null;
  return (
    <GameSwitchTabs
      items={games.map((game) => ({ game, href: `/admin/${game}`, label: t(game), notPublic: publicGames.includes(game) ? undefined : t("notPublicBadge") }))}
      current={current}
      groupLabel={t("switcherLabel")}
      className="flex-none"
    />
  );
}
