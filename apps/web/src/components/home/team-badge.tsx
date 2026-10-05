/**
 * GC-Stats - team-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { DEFAULT_TEAM_LOGO_DARK, DEFAULT_TEAM_LOGO_LIGHT } from "@/lib/default-logos";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

/** `sizeClassName` replaces the fixed `size` box (responsive sizes); `size` stays the image's intrinsic size. */
export function TeamBadge({ tag, size = 30, logoUrl, logoUrlLight, sizeClassName }: { tag: string; size?: number; logoUrl?: string | null; logoUrlLight?: string | null; sizeClassName?: string }) {
  const dark = logoUrl ?? DEFAULT_TEAM_LOGO_DARK;
  const light = logoUrlLight ?? logoUrl ?? DEFAULT_TEAM_LOGO_LIGHT;
  return (
    <span
      className={`relative flex flex-none items-center justify-center overflow-hidden rounded-lg ${sizeClassName ?? ""}`}
      style={sizeClassName ? undefined : { width: size, height: size }}
    >
      <ThemedLogoImage dark={dark} light={light} alt={tag} width={size} height={size} className="h-full w-full object-contain" />
    </span>
  );
}
