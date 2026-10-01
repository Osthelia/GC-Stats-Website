/**
 * GC-Stats - bracket-layout
 *
 * Pure, client-safe bracket layout algorithm shared by the public bracket
 * display (tournament-bracket-canvas.tsx) and the admin visual editor
 * (bracket-editor-canvas.tsx), no DB import, works off plain match/edge
 * DTOs so both call it identically instead of each reinventing positioning.
 *
 * Three things this computes:
 * 1. A container that's fed exclusively by winner-edges from another (root)
 *    container's lane joins that lane instead of getting its own, this is
 *    what makes a Grand Final draw as the straight continuation of the
 *    Upper bracket's row, while a Lower/Middle bracket (fed by at least one
 *    loser-edge) stays a separate lane below.
 * 2. Column = longest path from a source match (topological depth) across
 *    the whole graph, not a per-container `round`, so a merged container's
 *    matches land in the correct column after its anchor lane's matches
 *    automatically, with no special-casing.
 * 3. Y position = the average of a match's same-lane feeders (classic
 *    vertically-centered bracket tree), a lane's first column (no
 *    same-lane feeders yet, e.g. a Lower bracket's very first drop-in
 *    match) falls back to even spacing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export interface LayoutMatchInput {
  id: string;
  containerId: string;
  /** Floors the computed column at `round - 1` — a match with no incoming
   *  edge (e.g. a bye entrant seeded straight into round 2) would otherwise
   *  compute as column 0 like an actual round 1 match, since column is
   *  normally the longest incoming path. Without this floor a round with
   *  more matches than the round before it (some fed by edges, some
   *  direct-seeded) draws with its rounds visually mixed/reversed (real user
   *  report, 2026-09-21: a 2 R1/4 R2 bracket with byes into R2). */
  round: number;
  /** Manual row hint from the admin editor (`matches.display_order`) — used
   *  as the primary sort key wherever this layout falls back to a plain
   *  top-to-bottom order (a lane's first column, or a tie between matches
   *  with no same-lane feeder yet), so a round manually reordered in the
   *  editor draws in that same order here instead of by raw id (explicit
   *  user report, 2026-09-21: admin row saved fine, public order didn't
   *  follow it). */
  displayOrder?: number | null;
}

function compareByDisplayOrderThenId(a: LayoutMatchInput, b: LayoutMatchInput): number {
  const ad = a.displayOrder ?? null;
  const bd = b.displayOrder ?? null;
  if (ad !== null && bd !== null && ad !== bd) return ad - bd;
  if (ad !== null && bd === null) return -1;
  if (ad === null && bd !== null) return 1;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

export interface LayoutEdgeInput {
  fromMatchId: string;
  toMatchId: string;
  fromResult: "winner" | "loser";
}

export interface BracketLayoutOptions {
  columnWidth: number;
  rowHeight: number;
  laneGap: number;
}

export interface BracketLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  laneIndexByContainer: Map<string, number>;
  /** Top-of-lane cumulative y-offset per lane index — lets a caller compute
   *  a safe "gutter" y between two lanes (e.g. for routing a cross-lane
   *  connector through the empty band between lanes rather than across a
   *  lane's occupied row area). */
  laneOffsetY: Map<number, number>;
  totalHeight: number;
}

export function layoutBracket(matches: LayoutMatchInput[], edges: LayoutEdgeInput[], containerOrder: string[], opts: BracketLayoutOptions): BracketLayoutResult {
  const { columnWidth, rowHeight, laneGap } = opts;

  const matchContainer = new Map(matches.map((m) => [m.id, m.containerId]));
  const matchRound = new Map(matches.map((m) => [m.id, m.round]));
  const incoming = new Map<string, LayoutEdgeInput[]>();
  for (const e of edges) {
    const list = incoming.get(e.toMatchId) ?? [];
    list.push(e);
    incoming.set(e.toMatchId, list);
  }

  // 1. Column = longest path from a source match, memoized DFS.
  const column = new Map<string, number>();
  function computeColumn(id: string, guard: Set<string>): number {
    const cached = column.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return 0; // cycle guard — shouldn't happen on a valid graph
    guard.add(id);
    const ins = incoming.get(id) ?? [];
    const topological = ins.length === 0 ? 0 : 1 + Math.max(...ins.map((e) => computeColumn(e.fromMatchId, guard)));
    const c = Math.max(topological, matchRound.get(id)! - 1);
    column.set(id, c);
    return c;
  }
  for (const m of matches) computeColumn(m.id, new Set());

  // 2. Inter-container edges, to classify each container.
  const containerIds = [...new Set(matches.map((m) => m.containerId))];
  const interInto = new Map<string, { edge: LayoutEdgeInput; fromContainer: string }[]>();
  for (const c of containerIds) interInto.set(c, []);
  for (const e of edges) {
    const fromC = matchContainer.get(e.fromMatchId);
    const toC = matchContainer.get(e.toMatchId);
    if (fromC && toC && fromC !== toC) interInto.get(toC)!.push({ edge: e, fromContainer: fromC });
  }
  const isRoot = (c: string) => interInto.get(c)!.length === 0;
  const hasLoserInterEdge = (c: string) => interInto.get(c)!.some((x) => x.edge.fromResult === "loser");

  // 3. Resolve each container's lane anchor (itself if root/loser-fed, else
  //    the anchor of whichever winner-only source sits earliest in
  //    `containerOrder`).
  const laneAnchor = new Map<string, string>();
  function resolveAnchor(c: string): string {
    const cached = laneAnchor.get(c);
    if (cached) return cached;
    if (isRoot(c) || hasLoserInterEdge(c)) {
      laneAnchor.set(c, c);
      return c;
    }
    const sourceContainers = [...new Set(interInto.get(c)!.map((x) => x.fromContainer))];
    let best: string | null = null;
    let bestIndex = Infinity;
    for (const src of sourceContainers) {
      const anchor = resolveAnchor(src);
      const idx = containerOrder.indexOf(anchor);
      const effectiveIdx = idx === -1 ? Infinity : idx;
      if (effectiveIdx < bestIndex) {
        bestIndex = effectiveIdx;
        best = anchor;
      }
    }
    const resolved = best ?? c;
    laneAnchor.set(c, resolved);
    return resolved;
  }
  for (const c of containerIds) resolveAnchor(c);

  // 4. Distinct lanes, ordered by the anchor's position in `containerOrder`.
  const distinctAnchors = [...new Set(containerIds.map((c) => laneAnchor.get(c)!))];
  distinctAnchors.sort((a, b) => containerOrder.indexOf(a) - containerOrder.indexOf(b));
  const laneIndexByAnchor = new Map(distinctAnchors.map((a, i) => [a, i]));
  const laneIndexByContainer = new Map(containerIds.map((c) => [c, laneIndexByAnchor.get(laneAnchor.get(c)!)!]));

  // 5. Y positions, lane by lane, column by column (ascending): a lane's
  //    minimum column bootstraps with even spacing, every later column
  //    averages same-lane feeders (falling back to even spacing if a match
  //    happens to have none — only possible on a hand-built graph).
  const rawY = new Map<string, number>();
  const matchesByLane = new Map<number, LayoutMatchInput[]>();
  for (const m of matches) {
    const lane = laneIndexByContainer.get(m.containerId)!;
    const list = matchesByLane.get(lane) ?? [];
    list.push(m);
    matchesByLane.set(lane, list);
  }

  const laneMaxY = new Map<number, number>();
  for (const [lane, laneMatches] of matchesByLane) {
    const byColumn = new Map<number, LayoutMatchInput[]>();
    for (const m of laneMatches) {
      const col = column.get(m.id)!;
      const list = byColumn.get(col) ?? [];
      list.push(m);
      byColumn.set(col, list);
    }
    const columns = [...byColumn.keys()].sort((a, b) => a - b);

    for (const col of columns) {
      const colMatches = byColumn.get(col)!.sort(compareByDisplayOrderThenId);

      // Split this column into matches with a same-lane feeder (fed by an
      // earlier match in the SAME lane) and matches without one — a lane's
      // first column never has one, but neither does e.g. a bye seeded
      // straight into round 2, or a Lower bracket's very first drop-in
      // match (only cross-lane feeders).
      const rootMatches: LayoutMatchInput[] = [];
      const fedMatches: { m: LayoutMatchInput; feederYs: number[] }[] = [];
      for (const m of colMatches) {
        const feederYs = (incoming.get(m.id) ?? [])
          .filter((e) => laneIndexByContainer.get(matchContainer.get(e.fromMatchId)!) === lane)
          .map((e) => rawY.get(e.fromMatchId))
          .filter((y): y is number => y !== undefined);
        if (feederYs.length > 0) fedMatches.push({ m, feederYs });
        else rootMatches.push(m);
      }

      // Root-in-this-column matches: honor an explicit `displayOrder`
      // (saved by the admin editor) as the literal row index — a
      // deliberate placement, including a gap left empty on purpose —
      // matches without one auto-fill whatever rows are still free.
      const usedRows = new Set<number>();
      for (const m of rootMatches) {
        if (m.displayOrder !== undefined && m.displayOrder !== null) usedRows.add(m.displayOrder);
      }
      let nextAutoRow = 0;
      for (const m of rootMatches) {
        let row: number;
        if (m.displayOrder !== undefined && m.displayOrder !== null) {
          row = m.displayOrder;
        } else {
          while (usedRows.has(nextAutoRow)) nextAutoRow++;
          row = nextAutoRow;
          usedRows.add(row);
        }
        rawY.set(m.id, row * rowHeight);
      }

      // Fed matches: ALWAYS centered between their same-lane feeders,
      // regardless of any `displayOrder` saved for them — the admin editor
      // saves one for every match on each save (not just the one actually
      // moved), so honoring it here too would pin a match that should just
      // follow its sources (e.g. 2 matches converging into 1, or the Grand
      // Final continuing Upper's lane) to wherever it happened to sit in
      // the editor instead of staying centered (explicit user report,
      // 2026-09-21).
      for (const { m, feederYs } of fedMatches) {
        rawY.set(m.id, feederYs.reduce((a, b) => a + b, 0) / feederYs.length);
      }
    }
    laneMaxY.set(lane, Math.max(0, ...laneMatches.map((m) => rawY.get(m.id) ?? 0)));
  }

  // 6. Cumulative lane offsets, then final absolute positions.
  const laneOffsetY = new Map<number, number>();
  let cumulative = 0;
  for (let i = 0; i < distinctAnchors.length; i++) {
    laneOffsetY.set(i, cumulative);
    cumulative += (laneMaxY.get(i) ?? 0) + rowHeight + laneGap;
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const m of matches) {
    const lane = laneIndexByContainer.get(m.containerId)!;
    positions.set(m.id, { x: column.get(m.id)! * columnWidth, y: (rawY.get(m.id) ?? 0) + (laneOffsetY.get(lane) ?? 0) });
  }

  return { positions, laneIndexByContainer, laneOffsetY, totalHeight: cumulative };
}
