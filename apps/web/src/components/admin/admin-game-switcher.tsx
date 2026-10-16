"use client";

/**
 * GC-Stats - admin-game-switcher
 *
 * Valorant / League of Legends switch of the admin dashboard (/admin/{game}).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { GAMES } from "@gc-stats/db/game";
import { GameSwitchTabs } from "@/components/game-switch-tabs";
import { useRouteGame } from "@/lib/use-game";

export function AdminGameSwitcher() {
  const t = useTranslations("game");
  const current = useRouteGame();

  return (
    <GameSwitchTabs
      items={GAMES.map((game) => ({ game, href: `/admin/${game}`, label: t(game) }))}
      current={current}
      groupLabel={t("switcherLabel")}
      className="flex-none"
    />
  );
}
