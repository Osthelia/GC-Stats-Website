/**
 * GC-Stats - bracket-editor-layout
 *
 * Grid layout for the admin bracket editor canvas only, distinct from
 * lib/bracket-layout.ts (public read-only display + initial editor load),
 * which merges a grand-final container's lane into its upper bracket's lane
 * using global topological depth as the column. That trick made the editor
 * ambiguous to drag in: a node's x position didn't correspond 1:1 to its own
 * `round` field, so dragging it left/right didn't clearly mean "different round".
 *
 * Here every container is its own independent lane (no merging), and the
 * column is always `round - 1` within that container, matching the
 * persisted `matches.round` field exactly, so a snapped drag unambiguously
 * sets it. Row = position within the round, top to bottom; an explicit
 * `displayOrder` (matches.display_order, set by dragging a match in the
 * editor) pins a match to that exact row, leaving gaps for matches not yet
 * placed there, matches with no explicit order auto-fill the next free row.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export interface EditorLayoutMatchInput {
  id: string;
  containerId: string;
  round: number;
  displayOrder?: number | null;
}

export interface EditorLayoutOptions {
  columnWidth: number;
  rowHeight: number;
  laneGap: number;
  /** Vertical space reserved above row 0 for the round-header row. */
  headerHeight: number;
}

export interface EditorLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  /** Top-of-lane y (before headerHeight), keyed by containerId. */
  laneOffsetY: Map<string, number>;
  /** Total lane height (header + rows), keyed by containerId. */
  laneHeight: Map<string, number>;
  /** Distinct rounds present, ascending, keyed by containerId. */
  roundsByContainer: Map<string, number[]>;
  totalHeight: number;
}

export function layoutEditorGrid(matches: EditorLayoutMatchInput[], containerOrder: string[], opts: EditorLayoutOptions): EditorLayoutResult {
  const { columnWidth, rowHeight, laneGap, headerHeight } = opts;

  const byContainer = new Map<string, EditorLayoutMatchInput[]>();
  for (const m of matches) {
    const list = byContainer.get(m.containerId) ?? [];
    list.push(m);
    byContainer.set(m.containerId, list);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const laneOffsetY = new Map<string, number>();
  const laneHeight = new Map<string, number>();
  const roundsByContainer = new Map<string, number[]>();

  let cumulative = 0;
  for (const containerId of containerOrder) {
    laneOffsetY.set(containerId, cumulative);

    const containerMatches = byContainer.get(containerId) ?? [];
    const byRound = new Map<number, EditorLayoutMatchInput[]>();
    for (const m of containerMatches) {
      const list = byRound.get(m.round) ?? [];
      list.push(m);
      byRound.set(m.round, list);
    }
    const rounds = [...byRound.keys()].sort((a, b) => a - b);
    roundsByContainer.set(containerId, rounds);

    let maxRows = 0;
    for (const round of rounds) {
      const roundMatches = byRound.get(round)!;
      const explicit = roundMatches.filter((m) => m.displayOrder !== undefined && m.displayOrder !== null);
      const auto = roundMatches
        .filter((m) => m.displayOrder === undefined || m.displayOrder === null)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

      const rowByMatchId = new Map<string, number>();
      const usedRows = new Set<number>();
      for (const m of explicit) {
        rowByMatchId.set(m.id, m.displayOrder as number);
        usedRows.add(m.displayOrder as number);
      }
      let nextRow = 0;
      for (const m of auto) {
        while (usedRows.has(nextRow)) nextRow++;
        rowByMatchId.set(m.id, nextRow);
        usedRows.add(nextRow);
      }

      let maxRowThisRound = 0;
      for (const m of roundMatches) {
        const rowIndex = rowByMatchId.get(m.id)!;
        positions.set(m.id, { x: (round - 1) * columnWidth, y: cumulative + headerHeight + rowIndex * rowHeight });
        maxRowThisRound = Math.max(maxRowThisRound, rowIndex);
      }
      maxRows = Math.max(maxRows, maxRowThisRound + 1);
    }

    const thisLaneHeight = headerHeight + Math.max(maxRows, 1) * rowHeight;
    laneHeight.set(containerId, thisLaneHeight);
    cumulative += thisLaneHeight + laneGap;
  }

  return { positions, laneOffsetY, laneHeight, roundsByContainer, totalHeight: cumulative };
}

/** Row index (0-based) a node's current, already-grid-aligned y position sits at within its lane — used at save time to derive `displayOrder`. */
export function rowIndexFromY(y: number, containerId: string, layout: Pick<EditorLayoutResult, "laneOffsetY">, opts: EditorLayoutOptions): number {
  const laneBaseY = layout.laneOffsetY.get(containerId) ?? 0;
  const relY = y - laneBaseY - opts.headerHeight;
  return Math.max(0, Math.round(relY / opts.rowHeight));
}

/** Snaps a raw drag position to the grid: nearest round (>=1) and nearest row within its lane. Returns absolute pixel position + the resolved round. */
export function snapToGrid(
  x: number,
  y: number,
  containerId: string,
  layout: Pick<EditorLayoutResult, "laneOffsetY">,
  opts: EditorLayoutOptions
): { x: number; y: number; round: number } {
  const laneBaseY = layout.laneOffsetY.get(containerId) ?? 0;
  const round = Math.max(1, Math.round(x / opts.columnWidth) + 1);
  const relY = y - laneBaseY - opts.headerHeight;
  const rowIndex = Math.max(0, Math.round(relY / opts.rowHeight));
  return {
    x: (round - 1) * opts.columnWidth,
    y: laneBaseY + opts.headerHeight + rowIndex * opts.rowHeight,
    round,
  };
}
