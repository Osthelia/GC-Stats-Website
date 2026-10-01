/**
 * GC-Stats - org-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ThemedLogoImage } from "@/components/site/themed-logo-image";

/**
 * Organization logo tile with an initial-letter fallback — mirrors
 * `TeamBadge`, but organizations have no static default logo asset, so the
 * fallback is drawn (not another image) like `OrganizationHeader`'s own avatar.
 */
export function OrgBadge({
  name,
  logoUrl,
  logoUrlLight,
  size = 30,
}: {
  name: string;
  logoUrl?: string | null;
  logoUrlLight?: string | null;
  size?: number;
}) {
  const dark = logoUrl ?? logoUrlLight ?? null;
  const light = logoUrlLight ?? logoUrl ?? null;
  return (
    <span
      className="relative flex flex-none items-center justify-center overflow-hidden rounded-lg border border-neutral-800"
      style={{ width: size, height: size, background: "var(--gcs-surface-2)" }}
    >
      {dark && light ? (
        <ThemedLogoImage dark={dark} light={light} alt={name} width={size} height={size} className="h-full w-full object-contain" />
      ) : (
        <span className="font-black text-neutral-500" style={{ fontSize: Math.round(size * 0.4) }}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
