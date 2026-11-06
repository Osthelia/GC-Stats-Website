/**
 * GC-Stats - lol-side-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LeagueSide } from "@gc-stats/lol-stats-engine";

const STYLES: Record<LeagueSide, string> = {
  blue: "bg-sky-500/15 text-sky-400 border-sky-400/20",
  red: "bg-rose-500/15 text-rose-400 border-rose-400/20",
};

/** The blue or red side of a League game. `className` sets the size and spacing. */
export function LolSideBadge({ side, label, className }: { side: LeagueSide; label: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-semibold uppercase", STYLES[side], className)}>
      {label}
    </Badge>
  );
}
