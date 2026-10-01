/**
 * GC-Stats — Swiss pairing engine
 *
 * No static graph to generate up-front (unlike other generators). Called once
 * per round, given current entrant standings and full pairing history, to
 * produce that round's pairings. Pure functions only: DTOs in, DTOs out.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type SwissTiebreaker = "buchholz" | "round_diff" | "seed";

export interface SwissConfig {
  /** Entrant becomes "qualified" once wins reaches this. `null` = no cap (free-form Swiss). */
  qualifyAtWins: number | null;
  /** Entrant becomes "eliminated" once losses reaches this. `null` = no cap. */
  eliminateAtLosses: number | null;
  maxRounds: number;
  /** Best-of per round number, e.g. {1: 1, 5: 3} — falls back to 1 if unset. */
  roundFormat: Record<number, number>;
  /** Ordered tiebreaker chain used both for grouping order and pairing order. */
  tiebreakers: SwissTiebreaker[];
}

export interface SwissEntrant {
  id: string;
  seed: number;
  wins: number;
  losses: number;
  /** Stored in hundredths to avoid float drift (matches `group_entries.buchholz`). */
  buchholz: number;
  roundDiff: number;
  hadBye: boolean;
  status: "active" | "qualified" | "eliminated";
}

export interface SwissHistoryEntry {
  round: number;
  aId: string;
  /** `null` means `aId` had a bye that round. */
  bId: string | null;
}

export interface SwissPairing {
  aId: string;
  /** `null` means `aId` gets a bye this round (auto-win). */
  bId: string | null;
}

export interface SwissRoundResult {
  round: number;
  bestOf: number;
  pairings: SwissPairing[];
}

/** Active entrants, excluding anyone already qualified/eliminated. */
export function filterActive(entrants: SwissEntrant[]): SwissEntrant[] {
  return entrants.filter((e) => e.status === "active");
}

/**
 * Groups entrants by their EXACT (wins, losses) record — not by simple win
 * differential — to stay faithful to fixed VCT/GC score-group buckets (2-1
 * and 1-0 share a diff of +1 but are different buckets: different number of
 * matches played). Groups are returned ordered best record first.
 */
export function groupByRecord(entrants: SwissEntrant[]): SwissEntrant[][] {
  const buckets = new Map<string, SwissEntrant[]>();
  for (const e of entrants) {
    const key = `${e.wins}-${e.losses}`;
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort(([keyA], [keyB]) => {
      const [winsA, lossesA] = keyA.split("-").map(Number) as [number, number];
      const [winsB, lossesB] = keyB.split("-").map(Number) as [number, number];
      if (winsA !== winsB) return winsB - winsA; // more wins first
      return lossesA - lossesB; // fewer losses first
    })
    .map(([, list]) => list);
}

function tiebreakSort(entrants: SwissEntrant[], tiebreakers: SwissTiebreaker[]): SwissEntrant[] {
  return [...entrants].sort((a, b) => {
    for (const tb of tiebreakers) {
      if (tb === "buchholz" && a.buchholz !== b.buchholz) return b.buchholz - a.buchholz;
      if (tb === "round_diff" && a.roundDiff !== b.roundDiff) return b.roundDiff - a.roundDiff;
      if (tb === "seed" && a.seed !== b.seed) return a.seed - b.seed;
    }
    return a.seed - b.seed; // final stable fallback
  });
}

function hasPlayed(history: SwissHistoryEntry[], aId: string, bId: string): boolean {
  return history.some((h) => (h.aId === aId && h.bId === bId) || (h.aId === bId && h.bId === aId));
}

/**
 * Pairs a single (already tiebreak-sorted) group using "slide" order (top
 * half vs bottom half, index i vs index i+half) with anti-rematch
 * backtracking: if the ideal slide pairing contains a rematch, tries other
 * permutations of the bottom half before giving up. Groups are small in
 * practice (spec: <=16 round 1, usually <=8 after), so recursive
 * backtracking is more than fast enough — no need for a smarter matching
 * algorithm.
 *
 * Returns `null` if NO valid rematch-free pairing exists for this exact
 * group (caller must then merge with an adjacent group and retry).
 */
function pairGroupNoRematch(group: SwissEntrant[], history: SwissHistoryEntry[]): SwissPairing[] | null {
  if (group.length === 0) return [];
  if (group.length % 2 !== 0) {
    throw new Error("pairGroupNoRematch: group must have an even length (floaters resolved by the caller)");
  }

  const half = group.length / 2;
  const top = group.slice(0, half);
  const bottomIndices = group.slice(half).map((_, i) => i);

  function backtrack(topIndex: number, usedBottom: Set<number>, acc: SwissPairing[]): SwissPairing[] | null {
    if (topIndex === top.length) return acc;
    const a = top[topIndex]!;
    // Preference order: the ideal slide partner first (bottomIndices[topIndex]),
    // then the rest in order — stays as close to "slide" as possible.
    const preferenceOrder = [topIndex, ...bottomIndices.filter((i) => i !== topIndex)];
    for (const bIdx of preferenceOrder) {
      if (usedBottom.has(bIdx)) continue;
      const b = group[half + bIdx]!;
      if (hasPlayed(history, a.id, b.id)) continue;
      usedBottom.add(bIdx);
      const result = backtrack(topIndex + 1, usedBottom, [...acc, { aId: a.id, bId: b.id }]);
      if (result) return result;
      usedBottom.delete(bIdx);
    }
    return null;
  }

  return backtrack(0, new Set(), []);
}

export interface PairRoundOptions {
  round: number;
  entrants: SwissEntrant[];
  history: SwissHistoryEntry[];
  config: SwissConfig;
}

/**
 * Generates the pairings for one Swiss round.
 *
 * Steps (per spec): filter active -> group by exact record -> sort each
 * group by tiebreakers -> pair with anti-rematch backtracking, floating an
 * odd one out down to the next group (merging groups on total pairing
 * failure) -> a real bye only if the whole active pool is odd, given to
 * whoever hasn't had one yet, preferring the lowest-ranked floater.
 */
export function pairRound(options: PairRoundOptions): SwissRoundResult {
  const { round, entrants, history, config } = options;
  const active = filterActive(entrants);

  const bestOf = config.roundFormat[round] ?? 1;
  if (active.length === 0) {
    return { round, bestOf, pairings: [] };
  }

  const groups = groupByRecord(active).map((g) => tiebreakSort(g, config.tiebreakers));

  // Sequentially pair groups top to bottom, floating the lowest-ranked
  // entrant down to the next group whenever a valid rematch-free pairing
  // can't be found for it (merging with the next group and retrying, per
  // spec). `carry` holds floaters waiting to be merged into the next
  // (lower) group.
  const pairings: SwissPairing[] = [];
  let carry: SwissEntrant[] = [];

  for (let i = 0; i < groups.length; i++) {
    let pool = tiebreakSort([...carry, ...groups[i]!], config.tiebreakers);
    carry = [];
    const isLastGroup = i === groups.length - 1;

    // The total active pool's parity is invariant across floats (every
    // entrant is exactly once in "already paired" + "carry" + "pool"), so
    // an odd total shows up here, and only here, as a genuine bye — assign
    // it up front so the rest of this group's pool is always even.
    if (isLastGroup && pool.length % 2 === 1) {
      const byeEntrant = pickByeEntrant(pool);
      pairings.push({ aId: byeEntrant.id, bId: null });
      pool = pool.filter((e) => e.id !== byeEntrant.id);
    }

    while (pool.length > 0) {
      if (pool.length % 2 === 1) {
        // Only possible for a non-last group (last group was already made
        // even above): float the lowest-ranked entrant down and retry.
        const floater = pool[pool.length - 1]!;
        carry = [floater, ...carry];
        pool = pool.slice(0, -1);
        continue;
      }

      const result = pairGroupNoRematch(pool, history);
      if (result) {
        pairings.push(...result);
        pool = [];
        break;
      }

      if (isLastGroup) {
        // No rematch-free pairing exists even after merging everything
        // available — extremely small pools only. Fall back to the ideal
        // slide pairing (allowing a rematch) rather than leaving entrants
        // unpaired.
        const half = pool.length / 2;
        for (let k = 0; k < half; k++) {
          pairings.push({ aId: pool[k]!.id, bId: pool[half + k]!.id });
        }
        pool = [];
        break;
      }

      // Float the lowest-ranked entrant of this pool down and retry.
      const floater = pool[pool.length - 1]!;
      carry = [floater, ...carry];
      pool = pool.slice(0, -1);
    }
  }

  return { round, bestOf, pairings };
}

function pickByeEntrant(candidates: SwissEntrant[]): SwissEntrant {
  const neverHadBye = candidates.filter((e) => !e.hadBye);
  const pool = neverHadBye.length > 0 ? neverHadBye : candidates;
  // Lowest-ranked (last in tiebreak order) among eligible candidates.
  return pool[pool.length - 1]!;
}

/**
 * Recomputes Buchholz for every entrant: sum of the CURRENT win count of
 * every opponent faced so far (a bye counts as 0 contribution, matching
 * standard Swiss Buchholz treatment of byes). Stored in hundredths (int).
 */
export function recomputeBuchholz(entrants: SwissEntrant[], history: SwissHistoryEntry[]): SwissEntrant[] {
  const winsById = new Map(entrants.map((e) => [e.id, e.wins]));
  return entrants.map((e) => {
    let sum = 0;
    for (const h of history) {
      if (h.aId === e.id && h.bId) sum += winsById.get(h.bId) ?? 0;
      else if (h.bId === e.id) sum += winsById.get(h.aId) ?? 0;
    }
    return { ...e, buchholz: sum * 100 };
  });
}
