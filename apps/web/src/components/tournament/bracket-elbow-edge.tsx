/**
 * GC-Stats - bracket-elbow-edge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { BaseEdge, type EdgeProps } from "@xyflow/react";

export type BracketElbowEdgeData = {
  /**
   * Present only for a cross-lane connector — a y inside the empty gap
   * BETWEEN two lanes (never inside any lane's occupied row band), used to
   * route the long horizontal leg somewhere guaranteed free of match
   * nodes. Absent for a same-lane connector, which never needs it (see
   * below).
   */
  gutterY?: number;
};

const GAP_INSET = 18;

/**
 * A hand-built orthogonal connector — React Flow's `step`/`smoothstep`
 * edges route through their own offset logic and could add unwanted extra
 * corners, and neither guarantees staying clear of node bodies.
 *
 * Same-lane connector (no `gutterY`): 3 segments — horizontal out of the
 * source, one vertical jog at the midpoint between source and target,
 * horizontal into the target (collapses to a straight line when they share
 * a row). Provably collision-free: within one lane, every connector spans
 * exactly one column (the layout algorithm guarantees this), and the
 * midpoint between two adjacent columns always falls in the empty gap
 * between them (column width < column spacing), never inside a node.
 *
 * Cross-lane connector (`gutterY` set): 5 segments, routed entirely through
 * two kinds of guaranteed-empty corridor — each column's gap (no lane has a
 * node in that x-range, at ANY y) and the gutter between two lanes (no
 * lane's row band overlaps that y, at ANY x) — so the long horizontal leg
 * that would otherwise cut across a bracket's row of matches instead runs
 * through the empty band between lanes. Only when source and target are
 * genuinely several columns apart, though: when they're adjacent, the two
 * insets fall back to a single shared midpoint instead (see below) — a
 * fixed `GAP_INSET` on each side assumes a specific gap width, but a
 * handle's actual rendered position shifts that gap by a few px, so on an
 * adjacent-column edge the two insets could cross over each other and
 * produce a pointless few-px sideways jog instead of a straight line
 * (explicit user report, 2026-09-17).
 */
export function BracketElbowEdge({ id, sourceX, sourceY, targetX, targetY, style, markerEnd, data }: EdgeProps & { data?: BracketElbowEdgeData }) {
  const gutterY = data?.gutterY;
  const midX = sourceX + (targetX - sourceX) / 2;

  let path: string;
  if (gutterY === undefined) {
    path = `M ${sourceX},${sourceY} L ${midX},${sourceY} L ${midX},${targetY} L ${targetX},${targetY}`;
  } else {
    const nearSourceX = sourceX + GAP_INSET;
    const nearTargetX = targetX - GAP_INSET;
    path =
      nearSourceX >= nearTargetX
        ? `M ${sourceX},${sourceY} L ${midX},${sourceY} L ${midX},${targetY} L ${targetX},${targetY}`
        : `M ${sourceX},${sourceY} L ${nearSourceX},${sourceY} L ${nearSourceX},${gutterY} L ${nearTargetX},${gutterY} L ${nearTargetX},${targetY} L ${targetX},${targetY}`;
  }

  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}
