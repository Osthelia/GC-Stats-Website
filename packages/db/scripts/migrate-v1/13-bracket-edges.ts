/**
 * GC-Stats — 13-bracket-edges
 *
 * Backfills `bracket_edges` (the progression graph V1 never had) for
 * migrated bracket-type matches, by comparing round_number/match_order
 * between consecutive rounds. Only wires edges when the round-to-round
 * match count ratio is unambiguous, and skips group containers and phases
 * that mix upper and lower bracket rounds under one container.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { db, v1 } from "./connection";
import { getMappedId, preloadEntityType } from "./id-map";
import { bracketEdges, matches, stageContainers } from "../../src/schema";

// V1 never had a progression graph (see DATABASES.MD §2.5 — "ajout du
// graphe de progression qui n'existait pas en V1"): matches only carry
// round_number/round_name/match_order, free text with no "winner goes to
// match X slot Y" concept. This backfills `bracket_edges` for the migrated
// matches by comparing round_number+match_order, but ONLY where the
// mapping is unambiguous, and ONLY for bracket-type phases — a group
// (round_robin/swiss) phase's rounds are independent pairings, not an
// elimination progression, even when their match counts happen to line up
// like one (verified against real Neon data, 2026-09-12: an earlier
// version of this script had no such guard and wired up 107 matches
// across several Swiss/round-robin containers into bogus "winner advances
// to" edges purely because the count ratio coincidentally looked clean —
// removed by cleanupGroupContainerEdges() below before regenerating):
//
// - round R and round R+1 have the SAME match count (any count, not just
//   1): index-preserving 1:1 pairing (sorted by order), winner only,
//   toSlot 'a'. This covers both a simple 1-match final chain AND a
//   double-elim lower-bracket round that "grows" from drop-ins (e.g.
//   Lower Round 1's 2 matches -> Lower Round 2's 2 matches) — in the
//   latter case the exact opponent pairing this guesses may not match the
//   real historical seeding (which also merges in an upper-bracket
//   drop-in we have no record of), but the resulting COLUMN depth is
//   correct either way, which is what the layout algorithm
//   (lib/bracket-layout.ts) actually needs: it derives column purely from
//   edge depth, not from `round`, so a same-container round with zero
//   incoming edges was rendering one column too early (2026-09-12 bug
//   report, tournament "Game Changers 2026: North America Stage 2" —
//   Lower Round 2 collapsing onto Lower Round 1's column). Only slot 'a'
//   is filled; slot 'b' (the drop-in we can't recover) is left open
//   rather than guessed.
// - round R has exactly 2x the matches of round R+1 (standard single-elim
//   halving): sorted-by-order pair (2k-1, 2k) of round R feeds match k of
//   round R+1, winner only, toSlot 'a'/'b'. The 2 losers are NOT wired
//   anywhere — where they'd go (a lower bracket, elimination) isn't
//   recoverable from round/order alone.
// - any other ratio is left alone.
//
// A handful of V1 phases (4, see phase-tree.ts) hold BOTH an Upper-bracket
// and a Lower-bracket match directly (not split into separate phases) —
// for those, round_number order does NOT reflect a single bracket's
// progression (Upper and Lower rounds interleave under one phase), so a
// clean count ratio between two consecutive rounds there would produce a
// plausible-looking but WRONG edge (e.g. wiring an Upper Quarterfinal
// winner into "Lower Round 1"). Detected via round_name containing both
// "upper" and "lower" for the same phase, and skipped entirely.
export async function cleanupGroupContainerEdges() {
  const groupContainers = await db.query.stageContainers.findMany({ where: eq(stageContainers.containerType, "group") });
  if (groupContainers.length === 0) return;
  const groupContainerIds = groupContainers.map((c) => c.id);
  const groupMatches = await db.select({ id: matches.id }).from(matches).where(inArray(matches.containerId, groupContainerIds));
  if (groupMatches.length === 0) return;
  const deleted = await db.delete(bracketEdges)
    .where(inArray(bracketEdges.fromMatchId, groupMatches.map((m) => m.id)))
    .returning({ id: bracketEdges.id });
  console.log(`cleanupGroupContainerEdges: removed ${deleted.length} bogus edges from group-type containers`);
}

export async function generateBracketEdges() {
  await preloadEntityType("match");
  await preloadEntityType("phase_as_container");
  const [phaseRows] = await v1.query<any[]>("SELECT id, format FROM tournament_phases");
  const groupPhaseIds = new Set(
    (phaseRows as any[])
      .filter((p) => p.format === "round_robin" || p.format === "swiss" || p.format === "swiss_buchholz")
      .map((p) => p.id as number)
  );

  const [rows] = await v1.query<any[]>(
    "SELECT id, phase_id, round_number, match_order, round_name FROM matches ORDER BY phase_id, round_number, match_order"
  );
  // migration_id_map can outlive the row it points to (e.g. a since-deleted
  // test match) — trusting getMappedId blindly here hits the matches FK.
  // Cross-check against what's actually in V2 right now.
  const existingMatchIds = new Set((await db.select({ id: matches.id }).from(matches)).map((r) => r.id));

  const byPhase = new Map<number, any[]>();
  for (const row of rows as any[]) {
    if (groupPhaseIds.has(row.phase_id)) continue;
    if (!byPhase.has(row.phase_id)) byPhase.set(row.phase_id, []);
    byPhase.get(row.phase_id)!.push(row);
  }

  let created = 0, skippedAmbiguousRatio = 0, skippedMixedPhase = 0, skippedUnresolvedMatch = 0, skippedExisting = 0;

  for (const [, phaseMatches] of byPhase) {
    const hasUpper = phaseMatches.some((m) => /upper/i.test(m.round_name ?? ""));
    const hasLower = phaseMatches.some((m) => /lower/i.test(m.round_name ?? ""));
    if (hasUpper && hasLower) { skippedMixedPhase++; continue; }

    const rounds = new Map<number, any[]>();
    for (const m of phaseMatches) {
      if (!rounds.has(m.round_number)) rounds.set(m.round_number, []);
      rounds.get(m.round_number)!.push(m);
    }
    const sortedRoundNumbers = [...rounds.keys()].sort((a, b) => a - b);
    for (const r of sortedRoundNumbers) rounds.get(r)!.sort((a, b) => a.match_order - b.match_order);

    for (let i = 0; i < sortedRoundNumbers.length - 1; i++) {
      const a = rounds.get(sortedRoundNumbers[i])!;
      const b = rounds.get(sortedRoundNumbers[i + 1])!;

      const pairs: { from: [any] | [any, any]; to: any }[] = [];
      if (a.length === b.length) {
        for (let k = 0; k < b.length; k++) pairs.push({ from: [a[k]], to: b[k] });
      } else if (a.length === 2 * b.length) {
        for (let k = 0; k < b.length; k++) pairs.push({ from: [a[2 * k], a[2 * k + 1]], to: b[k] });
      } else {
        skippedAmbiguousRatio++;
        continue;
      }

      for (const { from, to } of pairs) {
        const toMatchId = await getMappedId("match", to.id);
        if (!toMatchId || !existingMatchIds.has(toMatchId)) { skippedUnresolvedMatch++; continue; }
        for (let slotIdx = 0; slotIdx < from.length; slotIdx++) {
          const fromMatchId = await getMappedId("match", from[slotIdx].id);
          if (!fromMatchId || !existingMatchIds.has(fromMatchId)) { skippedUnresolvedMatch++; continue; }
          const existing = await db.query.bracketEdges.findFirst({ where: eq(bracketEdges.fromMatchId, fromMatchId) });
          if (existing) { skippedExisting++; continue; }
          await db.insert(bracketEdges).values({
            fromMatchId,
            fromResult: "winner",
            toMatchId,
            toSlot: slotIdx === 0 ? "a" : "b",
          });
          created++;
        }
      }
    }
  }

  console.log(
    `bracket_edges: ${created} created, ${skippedExisting} already existed, ` +
    `${skippedAmbiguousRatio} round transitions skipped (ambiguous count ratio), ` +
    `${skippedMixedPhase} phases skipped (mixed upper/lower matches on one phase), ` +
    `${skippedUnresolvedMatch} matches unresolved`
  );
}
