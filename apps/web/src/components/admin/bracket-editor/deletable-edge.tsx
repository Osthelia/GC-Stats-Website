/**
 * GC-Stats - deletable-edge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { XIcon } from "lucide-react";

export type DeletableEdgeData = { onDelete: () => void; readOnly: boolean };
export type DeletableEdgeType = Edge<DeletableEdgeData>;

export function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: EdgeProps<DeletableEdgeType>) {
  const t = useTranslations("admin.tournaments.editor");
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {data && !data.readOnly && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title={t("deleteLinkTitle")}
            className="nodrag nopan pointer-events-auto absolute flex size-4 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete();
            }}
          >
            <XIcon className="size-2.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
