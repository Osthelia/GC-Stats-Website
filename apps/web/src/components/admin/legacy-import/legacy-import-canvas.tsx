/**
 * GC-Stats - legacy-import-canvas
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnNodeDrag,
  type OnNodesChange,
  type NodeChange,
  type OnEdgesChange,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { LegacySlotNode, type LegacySlotNodeData } from "@/components/admin/legacy-import/legacy-slot-node";
import { RoundHeaderNode, type RoundHeaderNodeData } from "@/components/admin/bracket-editor/round-header-node";
import { DeletableEdge, type DeletableEdgeData } from "@/components/admin/bracket-editor/deletable-edge";
import { layoutEditorGrid, snapToGrid, rowIndexFromY, type EditorLayoutOptions } from "@/lib/bracket-editor-layout";
import { CONTROLS_DARK_STYLE } from "@/lib/bracket-controls-style";
import type { EditorContainer, EditorMatch, EditorEdge } from "@/lib/admin-bracket-editor-data";

const LAYOUT_OPTS: EditorLayoutOptions = { columnWidth: 300, rowHeight: 140, laneGap: 80, headerHeight: 80 };
const HEADER_NODE_WIDTH = 224;
const HEADER_NODE_HEIGHT = 70;

const NODE_TYPES = { legacySlotNode: LegacySlotNode, roundHeaderNode: RoundHeaderNode };
const EDGE_TYPES = { deletable: DeletableEdge };

type CanvasNode = Node<LegacySlotNodeData> | Node<RoundHeaderNodeData>;

function entrantLabel(id: number | null, entrants: { id: number; displayName: string }[], tbdLabel: string): string {
  if (id === null) return tbdLabel;
  return entrants.find((e) => e.id === id)?.displayName ?? `#${id}`;
}

function buildInitial(
  tournamentId: number,
  targetContainers: EditorContainer[],
  targetMatches: EditorMatch[],
  targetEdges: EditorEdge[],
  entrants: { id: number; displayName: string }[],
  tbdLabel: string
) {
  const layoutInputMatches = targetMatches.map((m) => ({ id: String(m.id), containerId: String(m.containerId), round: m.round, displayOrder: m.displayOrder }));
  const containerOrder = targetContainers.map((c) => String(c.id));
  const layout = layoutEditorGrid(layoutInputMatches, containerOrder, LAYOUT_OPTS);

  const nodes: Node<LegacySlotNodeData>[] = targetMatches.map((m) => {
    const filled = m.entrantAId !== null || m.entrantBId !== null;
    return {
      id: String(m.id),
      type: "legacySlotNode",
      position: layout.positions.get(String(m.id)) ?? { x: 0, y: 0 },
      data: {
        matchId: m.id,
        containerName: targetContainers.find((c) => c.id === m.containerId)?.name ?? "",
        round: m.round,
        label: m.label,
        filled,
        slotALabel: entrantLabel(m.entrantAId, entrants, tbdLabel),
        slotBLabel: entrantLabel(m.entrantBId, entrants, tbdLabel),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        entrantAId: m.entrantAId,
        entrantBId: m.entrantBId,
        isPending: false,
        dropArmed: false,
        matchHref: filled ? `/admin/tournaments/${tournamentId}/matches/${m.id}` : null,
        onSlotClick: () => {},
        onDeleteEmpty: () => {},
        onUnassign: () => {},
      },
    };
  });

  const edges: Edge[] = targetEdges.map((e) => ({
    id: `${e.fromMatchId}:${e.fromResult}->${e.toMatchId}:${e.toSlot}`,
    source: String(e.fromMatchId),
    sourceHandle: e.fromResult,
    target: String(e.toMatchId),
    targetHandle: e.toSlot,
    type: "deletable",
    animated: false,
    style: { stroke: e.fromResult === "winner" ? "#10b981" : "#f43f5e" },
  }));

  return { nodes, edges, layout };
}

export function LegacyImportCanvas(props: {
  stageId: number;
  tournamentId: number;
  targetContainers: EditorContainer[];
  targetMatches: EditorMatch[];
  targetEdges: EditorEdge[];
  entrants: { id: number; displayName: string }[];
  pendingMatchId: number | null;
  selectedPoolMatchId: number | null;
  onSlotClick: (targetMatchId: number) => void;
  onDeleteEmpty: (matchId: number) => void;
  onUnassign: (matchId: number) => void;
  onMoveMatch: (matchId: number, round: number, displayOrder: number | null) => void;
  onConnectEdge: (fromMatchId: number, fromResult: "winner" | "loser", toMatchId: number, toSlot: "a" | "b") => void;
  onDisconnectEdge: (fromMatchId: number, fromResult: "winner" | "loser", toMatchId: number, toSlot: "a" | "b") => void;
}) {
  return (
    <ReactFlowProvider>
      <LegacyImportCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function LegacyImportCanvasInner({
  stageId,
  tournamentId,
  targetContainers,
  targetMatches,
  targetEdges,
  entrants,
  pendingMatchId,
  selectedPoolMatchId,
  onSlotClick,
  onDeleteEmpty,
  onUnassign,
  onMoveMatch,
  onConnectEdge,
  onDisconnectEdge,
}: {
  stageId: number;
  tournamentId: number;
  targetContainers: EditorContainer[];
  targetMatches: EditorMatch[];
  targetEdges: EditorEdge[];
  entrants: { id: number; displayName: string }[];
  pendingMatchId: number | null;
  selectedPoolMatchId: number | null;
  onSlotClick: (targetMatchId: number) => void;
  onDeleteEmpty: (matchId: number) => void;
  onUnassign: (matchId: number) => void;
  onMoveMatch: (matchId: number, round: number, displayOrder: number | null) => void;
  onConnectEdge: (fromMatchId: number, fromResult: "winner" | "loser", toMatchId: number, toSlot: "a" | "b") => void;
  onDisconnectEdge: (fromMatchId: number, fromResult: "winner" | "loser", toMatchId: number, toSlot: "a" | "b") => void;
}) {
  const tEditor = useTranslations("admin.tournaments.editor");
  const tbdLabel = tEditor("tbdLabel");

  const initial = useMemo(
    () => buildInitial(tournamentId, targetContainers, targetMatches, targetEdges, entrants, tbdLabel),
    [tournamentId, targetContainers, targetMatches, targetEdges, entrants, tbdLabel]
  );

  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<Node<LegacySlotNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState<Edge>(initial.edges);

  // Re-sync local canvas state whenever fresh server data comes in (after an
  // action + router.refresh()) — useNodesState/useEdgesState only consume
  // their initial value once (plain useState under the hood), so without
  // this a match added/assigned/moved server-side would never appear.
  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const layout = initial.layout;

  const onNodeDragStop: OnNodeDrag<Node<LegacySlotNodeData>> = useCallback(
    (_event, node) => {
      if (node.type !== "legacySlotNode") return;
      const containerId = targetMatches.find((m) => m.id === Number(node.id))?.containerId;
      if (containerId === undefined) return;
      const snapped = snapToGrid(node.position.x, node.position.y, String(containerId), layout, LAYOUT_OPTS);
      const displayOrder = rowIndexFromY(snapped.y, String(containerId), layout, LAYOUT_OPTS);
      setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, position: { x: snapped.x, y: snapped.y }, data: { ...n.data, round: snapped.round } } : n)));
      onMoveMatch(Number(node.id), snapped.round, displayOrder);
    },
    [targetMatches, layout, setNodes, onMoveMatch]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;
      onConnectEdge(Number(connection.source), connection.sourceHandle as "winner" | "loser", Number(connection.target), connection.targetHandle as "a" | "b");
    },
    [onConnectEdge]
  );

  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isPending: pendingMatchId === n.data.matchId,
          dropArmed: selectedPoolMatchId !== null,
          onSlotClick,
          onDeleteEmpty,
          onUnassign,
        },
      })),
    [nodes, pendingMatchId, selectedPoolMatchId, onSlotClick, onDeleteEmpty, onUnassign]
  );

  const edgesWithHandlers = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: "deletable",
        data: {
          onDelete: () => onDisconnectEdge(Number(e.source), e.sourceHandle as "winner" | "loser", Number(e.target), e.targetHandle as "a" | "b"),
          readOnly: false,
        } as DeletableEdgeData,
      })),
    [edges, onDisconnectEdge]
  );

  const roundHeaderNodes: Node<RoundHeaderNodeData>[] = useMemo(() => {
    const result: Node<RoundHeaderNodeData>[] = [];
    for (const container of targetContainers) {
      const rounds = layout.roundsByContainer.get(String(container.id)) ?? [];
      const maxRound = rounds.length > 0 ? Math.max(...rounds) : 1;
      const laneBaseY = layout.laneOffsetY.get(String(container.id)) ?? 0;
      for (let round = 1; round <= maxRound + 1; round++) {
        result.push({
          id: `round-header-${container.id}-${round}`,
          type: "roundHeaderNode",
          position: { x: (round - 1) * LAYOUT_OPTS.columnWidth, y: laneBaseY },
          draggable: false,
          selectable: false,
          width: HEADER_NODE_WIDTH,
          height: HEADER_NODE_HEIGHT,
          data: { containerId: container.id, stageId, round, commonScheduledAt: null },
        });
      }
    }
    return result;
  }, [targetContainers, layout, stageId]);

  const displayNodes: CanvasNode[] = [...nodesWithHandlers, ...roundHeaderNodes];

  // Adapters: managed node state only ever tracks legacySlotNode entries —
  // round headers are recomputed fresh every render and never
  // draggable/selectable, so any change reported for one is dropped here.
  const handleNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      const matchChanges = changes.filter((c) => "id" in c && nodes.some((n) => n.id === c.id)) as NodeChange<Node<LegacySlotNodeData>>[];
      onNodesChangeRaw(matchChanges);
    },
    [onNodesChangeRaw, nodes]
  );
  const handleNodeDragStop: OnNodeDrag<CanvasNode> = useCallback(
    (event, node) => {
      if (node.type !== "legacySlotNode") return;
      onNodeDragStop(event, node as Node<LegacySlotNodeData>, []);
    },
    [onNodeDragStop]
  );

  // Selecting an edge and pressing Backspace/Delete is xyflow's own removal
  // path (on top of DeletableEdge's explicit button) — route it through the
  // same server call so the underlying bracket_edges row actually goes away.
  const handleEdgesChange: OnEdgesChange<Edge> = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type !== "remove") continue;
        const removed = edges.find((e) => e.id === change.id);
        if (removed) onDisconnectEdge(Number(removed.source), removed.sourceHandle as "winner" | "loser", Number(removed.target), removed.targetHandle as "a" | "b");
      }
      onEdgesChangeRaw(changes.filter((c) => c.type !== "remove"));
    },
    [edges, onDisconnectEdge, onEdgesChangeRaw]
  );

  return (
    <div className="gcs-flow-canvas h-[600px] rounded-md border">
      <style>{CONTROLS_DARK_STYLE}</style>
      <ReactFlow<CanvasNode>
        nodes={displayNodes}
        edges={edgesWithHandlers}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        nodesConnectable
        nodesDraggable
        elementsSelectable
        panOnScroll
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
