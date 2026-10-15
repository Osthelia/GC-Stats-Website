"use client";

/**
 * GC-Stats - dashboard-game-switcher
 *
 * Game picker of the dashboard header, shown on the sections that exist
 * once per game (news, production, streams, VODs, veto). Veto only exists
 * for Valorant: switching to LoL from the veto page lands on the section
 * list instead.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { GAMES, gameHasVeto, isGameSlug, type GameSlug } from "@gc-stats/db/game";
import { GameSwitchTabs } from "@/components/game-switch-tabs";
import { usePathname } from "@/i18n/navigation";

type Scope = { current: GameSlug; hrefFor: (game: GameSlug) => string };

/** Parses /dashboard/{organizationId}/{game}/{section}, /dashboard/author/{game}/... and /dashboard/authors/{id}/{game}. */
function scopeOf(pathname: string): Scope | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "dashboard") return null;
  const isOrg = /^[0-9]+$/.test(segments[1] ?? "");
  const isAuthors = segments[1] === "authors" && /^[0-9]+$/.test(segments[2] ?? "");
  const gameIndex = isAuthors ? 3 : isOrg || segments[1] === "author" ? (isOrg ? 2 : 2) : -1;
  const current = segments[gameIndex];
  if (gameIndex < 0 || !isGameSlug(current)) return null;
  const prefix = segments.slice(0, gameIndex);
  const section = isOrg ? segments[gameIndex + 1] : undefined;
  return {
    current,
    hrefFor: (game) => {
      const keepSection = section && (section !== "veto" || gameHasVeto(game));
      return `/${[...prefix, game, ...(keepSection ? [section] : [])].join("/")}`;
    },
  };
}

export function DashboardGameSwitcher() {
  const t = useTranslations("game");
  const scope = scopeOf(usePathname());
  if (!scope) return null;

  return (
    <GameSwitchTabs
      items={GAMES.map((game) => ({ game, href: scope.hrefFor(game), label: t(game) }))}
      current={scope.current}
      groupLabel={t("switcherLabel")}
    />
  );
}
