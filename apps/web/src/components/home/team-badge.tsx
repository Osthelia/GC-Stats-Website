/**
 * GC-Stats - team-badge
 *
 * The logo of a team, or the default of the current game when it has none.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { defaultTeamLogos } from "@/lib/default-logos";
import { useGame } from "@/lib/use-game";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

/** `sizeClassName` replaces the fixed `size` box (responsive sizes); `size` stays the image's intrinsic size. */
export function TeamBadge({ tag, size = 30, logoUrl, logoUrlLight, sizeClassName }: { tag: string; size?: number; logoUrl?: string | null; logoUrlLight?: string | null; sizeClassName?: string }) {
  const defaults = defaultTeamLogos(useGame());
  const dark = logoUrl ?? defaults.dark;
  const light = logoUrlLight ?? logoUrl ?? defaults.light;
  return (
    <span
      className={`relative flex flex-none items-center justify-center ${sizeClassName ?? ""}`}
      style={sizeClassName ? undefined : { width: size, height: size }}
    >
      <ThemedLogoImage dark={dark} light={light} alt={tag} width={size} height={size} className="h-full w-full object-contain" />
    </span>
  );
}
