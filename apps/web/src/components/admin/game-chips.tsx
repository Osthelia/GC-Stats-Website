"use client";

/**
 * GC-Stats - game-chips
 *
 * Multi-select of games as toggle chips, for entities that can belong to several games.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { GAMES, type GameSlug } from "@gc-stats/db/game";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function GameChips({ id, value, onChange, invalid }: { id?: string; value: GameSlug[]; onChange: (games: GameSlug[]) => void; invalid?: boolean }) {
  const t = useTranslations("game");

  return (
    <div id={id} role="group" className="flex flex-wrap gap-1.5">
      {GAMES.map((game) => {
        const active = value.includes(game);
        return (
          <button
            key={game}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((g) => g !== game) : [...value, game])}
            className="cursor-pointer rounded-full transition-all hover:opacity-80 active:scale-95"
          >
            <Badge variant={active ? "default" : "outline"} className={cn(!active && "text-muted-foreground", invalid && !active && "border-destructive")}>
              {t(game)}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
