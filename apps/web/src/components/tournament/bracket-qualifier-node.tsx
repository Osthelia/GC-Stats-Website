/**
 * GC-Stats - bracket-qualifier-node
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FlagIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type BracketQualifierNodeData = {
  /** Qualified entrant, null until the source match is decided. */
  entrantName: string | null;
  tbdLabel: string;
  /** Full sentence ("X is qualified for Y"), shown on hover like V1's tooltip. */
  tooltip: string;
  href: string;
};

const QUALIFIED = "#3fb950";

export const BRACKET_QUALIFIER_NODE_WIDTH = 224;
export const BRACKET_QUALIFIER_NODE_HEIGHT = 36;

/**
 * V1's "Qualified" slot (`bracket-grid.blade.php`): a single-row box after a
 * bracket match whose winner/loser advances to another container, linking
 * to that container's stage. Green border like the standings' qualified
 * indicator.
 */
export function BracketQualifierNode({ data }: NodeProps & { data: BracketQualifierNodeData }) {
  return (
    <Link
      href={data.href}
      title={data.tooltip}
      className="nodrag nopan flex w-56 items-center justify-between gap-2 rounded-lg border px-2.5 transition-colors duration-150 hover:shadow-lg"
      style={{ height: BRACKET_QUALIFIER_NODE_HEIGHT, background: "var(--gcs-surface-3)", borderColor: `${QUALIFIED}4d` }}
    >
      <Handle type="target" position={Position.Left} id="a" style={{ top: BRACKET_QUALIFIER_NODE_HEIGHT / 2, background: "transparent", border: "none" }} />
      <span
        className="truncate text-[12.5px]"
        style={{ fontWeight: data.entrantName ? 700 : 500, color: data.entrantName ? "var(--gcs-text)" : "var(--gcs-text-tertiary)" }}
      >
        {data.entrantName ?? data.tbdLabel}
      </span>
      <FlagIcon className="size-3.5 flex-none" style={{ color: data.entrantName ? QUALIFIED : "var(--gcs-text-tertiary)" }} />
    </Link>
  );
}
