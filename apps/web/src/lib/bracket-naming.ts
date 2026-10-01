/**
 * GC-Stats - bracket-naming
 *
 * Configurable match-label naming for generator-built elimination brackets,
 * pluggable via a naming scheme object so labels stay separate from the
 * pure bracket engine, which only knows graph shape.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { BracketGraph, MatchNode } from "@gc-stats/bracket-engine";

// Configurable match-label naming for generator-built elimination brackets
// — kept out of the pure engine on purpose (labels are presentation, the
// engine only knows graph shape) and pluggable so a future site could swap
// in its own scheme without touching the generator or this module's
// callers, just the scheme object passed to `labelBracketTiers`.

export type BracketTier = "solo" | "upper" | "middle" | "lower";

export interface BracketNamingScheme {
  id: string;
  label: string;
  tierRoundLabel: (tier: BracketTier, round: number, totalRoundsInTier: number) => string;
}

const TIER_PREFIX: Record<BracketTier, string | null> = { solo: null, upper: "Upper", middle: "Middle", lower: "Lower" };

/**
 * GC-Stats' own scheme (2026-08-31, explicit spec from the user):
 *   Upper Round X / Upper Semifinals / Upper Final / Grand Final
 *   Middle Round X / Middle Final
 *   Lower Round X / Lower Final
 * "Semifinals" only applies to the upper tier's second-to-last round (a
 * middle/lower tier's drop-cascade rounds don't map cleanly to a
 * "semifinal" the way a single-elimination-shaped upper bracket's do) —
 * every other tier just counts up to "... Final".
 */
export const GC_STATS_NAMING_SCHEME: BracketNamingScheme = {
  id: "gcstats",
  label: "GC-Stats",
  tierRoundLabel(tier, round, totalRoundsInTier) {
    const prefix = TIER_PREFIX[tier];
    const isFinal = round === totalRoundsInTier;
    const isSemifinal = tier === "upper" && !isFinal && totalRoundsInTier >= 2 && round === totalRoundsInTier - 1;
    const suffix = isFinal ? "Final" : isSemifinal ? "Semifinals" : `Round ${round}`;
    return prefix ? `${prefix} ${suffix}` : suffix;
  },
};

/**
 * Relabels every match in `graph` whose (generator-temporary) containerId
 * is present in `tierByContainerId` — matches in containers NOT listed
 * (e.g. a grand final container already carrying "Grand Final"/"Final 1"
 * from the generator itself) are left exactly as the generator labeled
 * them.
 */
export function labelBracketTiers(graph: BracketGraph, tierByContainerId: Partial<Record<string, BracketTier>>, scheme: BracketNamingScheme = GC_STATS_NAMING_SCHEME): BracketGraph {
  const maxRoundByContainer = new Map<string, number>();
  for (const m of graph.matches) {
    if (!(m.containerId in tierByContainerId)) continue;
    maxRoundByContainer.set(m.containerId, Math.max(maxRoundByContainer.get(m.containerId) ?? 0, m.round));
  }

  const matches: MatchNode[] = graph.matches.map((m) => {
    const tier = tierByContainerId[m.containerId];
    if (!tier) return m;
    return { ...m, label: scheme.tierRoundLabel(tier, m.round, maxRoundByContainer.get(m.containerId)!) };
  });

  return { ...graph, matches };
}
