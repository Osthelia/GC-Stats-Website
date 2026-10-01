/**
 * GC-Stats - valorant-maps
 *
 * Current (2026) VALORANT competitive map pool — mirrors V1's
 * MatchController::MAP_POOL (Website/app/Http/Controllers/Admin/MatchController.php),
 * hardcoded the same way there (no reference table, cf. packages/db/src/schema/stats.ts
 * header comment: map names are plain display text, never normalized).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const VALORANT_MAP_POOL = ["Abyss", "Ascent", "Bind", "Breeze", "Corrode", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Summit", "Sunset"] as const;

// Sentinel for "map not yet decided" — a real, selectable option (not a
// missing value) so a map row can be created before the deciding map is
// known, per explicit request (2026-09-01).
export const MAP_UNKNOWN = "Unknown";

export const MAP_OPTIONS = [...VALORANT_MAP_POOL, MAP_UNKNOWN] as const;

/** Full-width splash art (V1 `storage/maps/{name}.webp`, ported verbatim to `public/valorant/maps/splash/`) — distinct from the top-down tactical minimap in lib/valorant-minimaps.ts. Null for `MAP_UNKNOWN`/an unrecognized name: no fallback image, callers render a plain surface instead. */
export function mapSplashUrl(mapName: string | null): string | null {
  if (!mapName) return null;
  const slug = mapName.toLowerCase();
  if (!(VALORANT_MAP_POOL as readonly string[]).includes(mapName)) return null;
  return `/valorant/maps/splash/${slug}.webp`;
}
