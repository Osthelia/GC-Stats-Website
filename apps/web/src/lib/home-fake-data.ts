/**
 * GC-Stats - home-fake-data
 *
 * Region/color constants, timezone/language lists, and placeholder team
 * logos for the home page. Team/tournament/publisher names and logos are the
 * real ones from the current production site (downloaded into public/logos/)
 * so the page reads as a real GC-Stats page rather than a mockup.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const GOLD = "#e4ae22";
export const RED = "#f2555a";

export type RegionKey = "emea" | "na" | "latam" | "brazil" | "pacific" | "china" | "other";

// Colors match V1's config/regions.php exactly (VCT region branding) rather
// than the source design mock's placeholder palette — Americas/North
// America/Brazil/LATAM all share the same orange there (one "Americas"
// umbrella color), so those four legitimately look identical here too.
export const REGIONS: Record<RegionKey, { label: string; color: string; short: string }> = {
  emea: { label: "EMEA", color: "#C8E000", short: "EU" },
  na: { label: "North America", color: "#FF6B35", short: "NA" },
  latam: { label: "LATAM", color: "#FF6B35", short: "LA" },
  brazil: { label: "Brazil", color: "#FF6B35", short: "BR" },
  pacific: { label: "Pacific", color: "#00C8FF", short: "PA" },
  china: { label: "China", color: "#FF1744", short: "CN" },
  // Catch-all for anything V1's own config/regions.php doesn't define either
  // (its 'colors' map only covers Americas/EMEA/Pacific/China/North America/
  // Brazil/LATAM/SEA) — V1 tournament data also has Japan/Asia/Korea/TBD
  // with no official brand color, so this is a neutral fallback, not a
  // guessed brand color.
  other: { label: "TBD", color: "#8a8a8a", short: "—" },
};

// V1's `tournaments.region` (and `matches.region` via its tournament) stores
// the real VCT display label (e.g. "North America"), not a lowercase slug —
// migrated verbatim from V1 in packages/db/scripts/migrate-v1/04-tournaments.ts.
// Matches V1's config/regions.php key set, plus 'SEA' (shares Pacific's
// color there) and 'Americas' (shares the same orange as North America).
const REGION_LABEL_TO_KEY: Record<string, RegionKey> = {
  EMEA: "emea",
  "North America": "na",
  Americas: "na",
  LATAM: "latam",
  Brazil: "brazil",
  Pacific: "pacific",
  SEA: "pacific",
  China: "china",
};

export function normalizeRegion(raw: string | null | undefined): RegionKey {
  if (!raw) return "other";
  return REGION_LABEL_TO_KEY[raw] ?? "other";
}

export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Team crests downloaded from gc-stats.app/teams (see apps/web/public/logos/teams).
// Teams without a custom crest on the real site fall back to the same
// default-dark/light.webp pair production uses — accurate to prod, not a cop-out.
const TEAM_LOGOS: Record<string, string> = {
  AKV: "/logos/teams/akv.webp",
  FSX: "/logos/teams/fsx.webp",
  TSE: "/logos/teams/tse.webp",
  CSC: "/logos/teams/csc.webp",
  CAL: "/logos/teams/cal.webp",
  LPG: "/logos/teams/lpg.webp",
  MTG: "/logos/teams/mtg.webp",
  M8: "/logos/teams/m8.webp",
  G2: "/logos/teams/g2.webp",
  FLY: "/logos/teams/fly.webp",
  MVS: "/logos/teams/mvs.webp",
};
const DEFAULT_TEAM_LOGO_DARK = "/logos/teams/default-dark.webp";
const DEFAULT_TEAM_LOGO_LIGHT = "/logos/teams/default-light.webp";

export function teamLogo(tag: string): string {
  return TEAM_LOGOS[tag] ?? DEFAULT_TEAM_LOGO_DARK;
}

export function teamLogoLight(tag: string): string {
  return TEAM_LOGOS[tag] ?? DEFAULT_TEAM_LOGO_LIGHT;
}

export type MatchStatus = "live" | "upcoming" | "finished";

// Tournament/news/match content now comes from the DB — see
// apps/web/src/lib/home-data.ts and packages/db/scripts/seed-home-fake-data.ts.
// GC-Stats is the only publisher with a real logo on the production site,
// so it's still used as a static fallback for every news item's logo.
export const GC_STATS_PUBLISHER_LOGO = "/logos/publishers/gc-stats.webp";
export const DEFAULT_TOURNAMENT_LOGO = "/logos/tournaments/default.webp";

export const LANGS = [
  { code: "en", flag: "🇬🇧", name: "English" },
  { code: "fr", flag: "🇫🇷", name: "Français" },
  { code: "es", flag: "🇪🇸", name: "Español" },
  { code: "pt", flag: "🇧🇷", name: "Português" },
];

export const TIMEZONES = [
  { id: "Europe/Paris", offset: "+02:00" }, { id: "Europe/London", offset: "+01:00" },
  { id: "Europe/Berlin", offset: "+02:00" }, { id: "Europe/Madrid", offset: "+02:00" },
  { id: "Europe/Lisbon", offset: "+01:00" }, { id: "Europe/Rome", offset: "+02:00" },
  { id: "Europe/Warsaw", offset: "+02:00" }, { id: "Europe/Kyiv", offset: "+03:00" },
  { id: "Europe/Istanbul", offset: "+03:00" }, { id: "Europe/Moscow", offset: "+03:00" },
  { id: "UTC", offset: "+00:00" },
  { id: "America/New_York", offset: "−04:00" }, { id: "America/Chicago", offset: "−05:00" },
  { id: "America/Denver", offset: "−06:00" }, { id: "America/Los_Angeles", offset: "−07:00" },
  { id: "America/Toronto", offset: "−04:00" }, { id: "America/Mexico_City", offset: "−06:00" },
  { id: "America/Bogota", offset: "−05:00" }, { id: "America/Lima", offset: "−05:00" },
  { id: "America/Santiago", offset: "−04:00" }, { id: "America/Buenos_Aires", offset: "−03:00" },
  { id: "America/Sao_Paulo", offset: "−03:00" },
  { id: "Africa/Casablanca", offset: "+01:00" }, { id: "Africa/Lagos", offset: "+01:00" },
  { id: "Africa/Johannesburg", offset: "+02:00" }, { id: "Africa/Cairo", offset: "+03:00" },
  { id: "Asia/Dubai", offset: "+04:00" }, { id: "Asia/Karachi", offset: "+05:00" },
  { id: "Asia/Kolkata", offset: "+05:30" }, { id: "Asia/Bangkok", offset: "+07:00" },
  { id: "Asia/Jakarta", offset: "+07:00" }, { id: "Asia/Singapore", offset: "+08:00" },
  { id: "Asia/Shanghai", offset: "+08:00" }, { id: "Asia/Manila", offset: "+08:00" },
  { id: "Asia/Seoul", offset: "+09:00" }, { id: "Asia/Tokyo", offset: "+09:00" },
  { id: "Australia/Perth", offset: "+08:00" }, { id: "Australia/Brisbane", offset: "+10:00" },
  { id: "Australia/Sydney", offset: "+10:00" }, { id: "Pacific/Auckland", offset: "+12:00" },
];

export const ACCENTS = [
  { name: "GC Yellow", color: GOLD },
  { name: "Coral", color: RED },
  { name: "Violet", color: "#c07ae8" },
  { name: "Azure", color: "#5b9bf0" },
  { name: "Mint", color: "#3fc27f" },
];
