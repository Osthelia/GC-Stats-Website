"use client";

/**
 * GC-Stats - game-switch-tabs
 *
 * Shared Valorant / League of Legends toggle (site header, dashboard, admin).
 * A thumb slides between the two official marks and takes the palette of the
 * selected game: Valorant red on dark blue-grey, League gold on hextech navy.
 * Callers only provide the links.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { GAMES, GAME_INFO, type GameSlug } from "@gc-stats/db/game";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Official marks (Simple Icons paths, 24x24 viewBox).
const MARK_PATHS: Record<GameSlug, string> = {
  valorant:
    "M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z",
  lol: "m1.912 0 1.212 2.474v19.053L1.912 24h14.73l1.337-4.682H8.33V0ZM12 1.516c-.913 0-1.798.112-2.648.312v1.74a9.738 9.738 0 0 1 2.648-.368c5.267 0 9.536 4.184 9.536 9.348a9.203 9.203 0 0 1-2.3 6.086l-.273.954-.602 2.112c2.952-1.993 4.89-5.335 4.89-9.122C23.25 6.468 18.213 1.516 12 1.516Zm0 2.673c-.924 0-1.814.148-2.648.414v13.713h8.817a8.246 8.246 0 0 0 2.36-5.768c0-4.617-3.818-8.359-8.529-8.359zM2.104 7.312A10.858 10.858 0 0 0 .75 12.576c0 1.906.492 3.7 1.355 5.266z",
};

// Track and thumb palette per selected game.
const THEME: Record<GameSlug, { track: string; thumb: string; onThumb: string; idleHover: string }> = {
  valorant: {
    track: "border-[#ff4655]/40 bg-[#0f1923]",
    thumb: "bg-[#ff4655] shadow-[0_0_14px_#ff465566]",
    onThumb: "text-[#ece8e1]",
    idleHover: "hover:text-[#ff4655]",
  },
  lol: {
    track: "border-[#c8aa6e]/50 bg-[#0a1428]",
    thumb: "bg-gradient-to-b from-[#f0e6d2] to-[#c8aa6e] shadow-[0_0_14px_#c8aa6e55]",
    onThumb: "text-[#0a1428]",
    idleHover: "hover:text-[#c8aa6e]",
  },
};

// Used outside the per-game pages: no game selected, so no thumb.
const NEUTRAL_THEME = {
  track: "border-neutral-600/50 bg-[#0f1923]",
  thumb: "",
  onThumb: "text-neutral-400",
  idleHover: "hover:text-white",
};

export type GameSwitchItem = { game: GameSlug; href: string; label: string };

export function GameSwitchTabs({
  items,
  current,
  groupLabel,
  className,
}: {
  items: GameSwitchItem[];
  current: GameSlug | null;
  groupLabel: string;
  className?: string;
}) {
  const theme = current ? THEME[current] : NEUTRAL_THEME;
  const index = current ? Math.max(0, GAMES.indexOf(current)) : 0;

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn("relative grid grid-cols-2 rounded-md border p-0.5 transition-colors duration-300", theme.track, className)}
    >
      {current && (
        <span
          aria-hidden="true"
          style={{ transform: `translateX(${index * 100}%)` }}
          className={cn("pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[4px] transition-all duration-300 ease-out", theme.thumb)}
        />
      )}
      {items.map(({ game, href, label }) => {
        const active = game === current;
        return (
          <Link
            key={game}
            href={href}
            aria-current={active ? "true" : undefined}
            title={label}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] transition-colors duration-300 active:scale-[0.95]",
              active ? theme.onThumb : cn("text-neutral-400", theme.idleHover),
            )}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 flex-none fill-current">
              <path d={MARK_PATHS[game]} />
            </svg>
            <span>{GAME_INFO[game].shortName}</span>
          </Link>
        );
      })}
    </div>
  );
}
