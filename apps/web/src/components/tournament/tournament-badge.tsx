/**
 * GC-Stats - tournament-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { DEFAULT_TOURNAMENT_LOGO } from "@/lib/home-fake-data";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

/**
 * Tournament logo tile — real logo when uploaded, otherwise the site's
 * generic tournament icon (mirrors TeamBadge/OrgBadge, but tournaments have
 * a static default asset instead of falling back to initials).
 */
export function TournamentBadge({
  name,
  logoUrl,
  logoUrlLight,
  size = 30,
  bare = false,
}: {
  name: string;
  logoUrl?: string | null;
  logoUrlLight?: string | null;
  size?: number;
  /** Skip the bordered tile background — just the logo itself. */
  bare?: boolean;
}) {
  const dark = logoUrl || DEFAULT_TOURNAMENT_LOGO;
  const light = logoUrlLight || logoUrl || DEFAULT_TOURNAMENT_LOGO;
  return (
    <span
      className={`relative flex flex-none items-center justify-center overflow-hidden ${bare ? "" : "rounded-lg border border-neutral-800"}`}
      style={{ width: size, height: size, background: bare ? "transparent" : "var(--gcs-surface-2)" }}
    >
      <ThemedLogoImage dark={dark} light={light} alt={name} width={size} height={size} className="h-full w-full object-contain" />
    </span>
  );
}
