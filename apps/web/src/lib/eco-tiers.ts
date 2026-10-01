/**
 * GC-Stats - eco-tiers
 *
 * Round win rate per economy tier (loadout value spent).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const ECO_TIERS = [
  { key: "eco", min: 0, max: 5000 },
  { key: "semi_eco", min: 5001, max: 10000 },
  { key: "semi_buy", min: 10001, max: 20000 },
  { key: "full_buy", min: 20001, max: 1_000_000 },
] as const;

export type EcoTierKey = (typeof ECO_TIERS)[number]["key"];
export type EcoTierSummary = Record<EcoTierKey, { win: number; total: number }>;

export function emptyEcoTierSummary(): EcoTierSummary {
  return Object.fromEntries(ECO_TIERS.map((t) => [t.key, { win: 0, total: 0 }])) as EcoTierSummary;
}

export function loadoutTierFor(spent: number): EcoTierKey | undefined {
  return ECO_TIERS.find((t) => spent >= t.min && spent <= t.max)?.key;
}
