"use client";

/**
 * GC-Stats - game-switcher
 *
 * Valorant / League of Legends switch of the header: a dropdown with the game mark
 * and an arrow on desktop (`GameDropdown`), the two-tab toggle in the mobile menu
 * (`GameSwitcher`). Both keep the visitor on the same listing (tournaments,
 * matches, news) when there is one, else open the home of the other game, since
 * team, player and match ids do not exist across games.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import type { GameSlug } from "@gc-stats/db/game";
import { GameMark, GameSwitchTabs } from "@/components/game-switch-tabs";
import { Link, usePathname } from "@/i18n/navigation";
import { useGame, useRouteGame } from "@/lib/use-game";
import type { ViewableGame } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const KEPT_LISTINGS = ["tournaments", "match", "news"];

// Highlight of the dropdown per game: Valorant's red and League's gold (the one of the old toggle).
const ACCENT: Record<GameSlug, string> = { valorant: "#ff4655", lol: "#c8aa6e" };

function targetFor(pathname: string, game: GameSlug): string {
  const segments = pathname.split("/").filter(Boolean);
  const listing = segments[1];
  return segments.length === 2 && listing && KEPT_LISTINGS.includes(listing) ? `/${game}/${listing}` : `/${game}`;
}

export function GameSwitcher({ games, className }: { games: ViewableGame[]; className?: string }) {
  const t = useTranslations("game");
  const pathname = usePathname();
  const current = useRouteGame();

  return (
    <GameSwitchTabs
      items={games.map(({ game, preview }) => ({ game, href: targetFor(pathname, game), label: t(game), notPublic: preview ? t("notPublicBadge") : undefined }))}
      current={current}
      groupLabel={t("switcherLabel")}
      className={cn("flex-none", className)}
    />
  );
}

/** Header dropdown, built like the language one: the mark of the current game and an arrow, the games in a panel. */
export function GameDropdown({ games, open, onToggle }: { games: ViewableGame[]; open: boolean; onToggle: (open: boolean) => void }) {
  const t = useTranslations("game");
  const pathname = usePathname();
  const routeGame = useRouteGame();
  const game = useGame();

  // Nothing to switch to with a single game.
  if (games.length < 2) return null;

  return (
    <div className="relative flex-none">
      <button
        type="button"
        aria-label={t("switcherLabel")}
        title={t(game)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}
        className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface)] px-2.5 hover:bg-[var(--gcs-hover)]"
        style={{ color: ACCENT[game] }}
      >
        <GameMark game={game} className="size-[18px]" />
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--gcs-text-tertiary)" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M5 9l7 7 7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-[46px] z-[70] w-[186px] rounded-xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,.7)]"
        >
          {games.map(({ game: slug, preview }) => {
            const active = slug === routeGame;
            return (
              <Link
                key={slug}
                href={targetFor(pathname, slug)}
                role="menuitem"
                aria-current={active ? "true" : undefined}
                onClick={() => onToggle(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-[var(--gcs-hover)]"
                style={{
                  background: active ? "var(--gcs-hover)" : undefined,
                  color: active ? ACCENT[slug] : "var(--gcs-text-dim)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <GameMark game={slug} />
                <span>{t(slug)}</span>
                {preview && <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400">{t("notPublicBadge")}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
