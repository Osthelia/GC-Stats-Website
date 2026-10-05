/**
 * GC-Stats - tournament-regions
 *
 * Display metadata (label, color, short code) for the competitive regions
 * stored in `tournaments.region`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export type RegionKey = "emea" | "na" | "latam" | "brazil" | "pacific" | "china" | "international" | "other";

// VCT region branding: the Americas regions share one orange.
export const REGIONS: Record<RegionKey, { label: string; color: string; short: string }> = {
  emea: { label: "EMEA", color: "#C8E000", short: "EU" },
  na: { label: "North America", color: "#FF6B35", short: "NA" },
  latam: { label: "LATAM", color: "#FF6B35", short: "LA" },
  brazil: { label: "Brazil", color: "#FF6B35", short: "BR" },
  pacific: { label: "Pacific", color: "#00C8FF", short: "PA" },
  china: { label: "China", color: "#FF1744", short: "CN" },
  international: { label: "International", color: "#665400", short: "INT" },
  // Neutral fallback for regions without a brand color (Japan, Korea, TBD...).
  other: { label: "TBD", color: "#8a8a8a", short: "—" },
};

// `tournaments.region` stores the display label (e.g. "North America"), not a slug.
const REGION_LABEL_TO_KEY: Record<string, RegionKey> = {
  EMEA: "emea",
  "North America": "na",
  Americas: "na",
  LATAM: "latam",
  Brazil: "brazil",
  Pacific: "pacific",
  SEA: "pacific",
  China: "china",
  International: "international",
};

export function normalizeRegion(raw: string | null | undefined): RegionKey {
  if (!raw) return "other";
  return REGION_LABEL_TO_KEY[raw] ?? "other";
}
