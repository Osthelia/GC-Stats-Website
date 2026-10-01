/**
 * GC-Stats - bracket-editor-canvas
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnNodeDrag,
  type OnNodesChange,
  type NodeChange,
  type OnEdgesChange,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BracketGraph, MatchNode as EngineMatchNode } from "@gc-stats/bracket-engine";
import { MatchNode, type MatchNodeData } from "@/components/admin/bracket-editor/match-node";
import { RoundHeaderNode, type RoundHeaderNodeData } from "@/components/admin/bracket-editor/round-header-node";
import { GenerateTemplateForm } from "@/components/admin/bracket-editor/generate-template-form";
import { DeletableEdge, type DeletableEdgeData } from "@/components/admin/bracket-editor/deletable-edge";
import { saveManualGraph, type EditorSlotSource } from "@/actions/admin-bracket-editor";
import { layoutEditorGrid, snapToGrid, rowIndexFromY, type EditorLayoutOptions } from "@/lib/bracket-editor-layout";
import { validateEditorGraph } from "@/lib/bracket-editor-validation";
import { CONTROLS_DARK_STYLE } from "@/lib/bracket-controls-style";
import type { EditorContainer, EditorMatch, EditorEdge } from "@/lib/admin-bracket-editor-data";

const LAYOUT_OPTS: EditorLayoutOptions = { columnWidth: 300, rowHeight: 140, laneGap: 80, headerHeight: 80 };
const HEADER_NODE_WIDTH = 224;
const HEADER_NODE_HEIGHT = 70;

const NODE_TYPES = { matchNode: MatchNode, roundHeaderNode: RoundHeaderNode };
const EDGE_TYPES = { deletable: DeletableEdge };

/** Round headers are decorative, non-draggable/non-selectable nodes rendered alongside the managed matchNode state — this union is only for the ReactFlow `nodes` prop and its change handlers, never stored in useNodesState itself. */
type CanvasNode = Node<MatchNodeData> | Node<RoundHeaderNodeData>;

function slotSourceFromEditorMatch(m: EditorMatch, slot: "a" | "b", edges: EditorEdge[]): EditorSlotSource {
  const fedByEdge = edges.some((e) => e.toMatchId === m.id && e.toSlot === slot);
  if (fedByEdge) return { type: "edge" };
  const seed = m.seeds.find((s) => s.slot === slot);
  if (seed?.sourceType === "bye") return { type: "bye" };
  if (seed?.sourceType === "seed") return { type: "entrant", entrantId: (seed.sourceRef as { seed: number }).seed };
  // No edge, no seed: a match created empty (e.g. operations bulk-create,
  // or a manually-added TBD match) — genuinely not assigned yet.
  return { type: "unset" };
}

function entrantLabel(id: number | null, entrants: { id: number; displayName: string }[], tbdLabel: string): string {
  if (id === null) return tbdLabel;
  return entrants.find((e) => e.id === id)?.displayName ?? `#${id}`;
}

export function BracketEditorCanvas({
  tournamentId,
  stageId,
  stageStatus,
  containers,
  initialMatches,
  initialEdges,
  entrants,
}: {
  tournamentId: number;
  stageId: number;
  stageStatus: "pending" | "active" | "completed";
  containers: EditorContainer[];
  initialMatches: EditorMatch[];
  initialEdges: EditorEdge[];
  entrants: { id: number; displayName: string; seed: number | null }[];
}) {
  return (
    <ReactFlowProvider>
      <BracketEditorCanvasInner
        tournamentId={tournamentId}
        stageId={stageId}
        stageStatus={stageStatus}
        containers={containers}
        initialMatches={initialMatches}
        initialEdges={initialEdges}
        entrants={entrants}
      />
    </ReactFlowProvider>
  );
}

function buildInitialGraph(
  tournamentId: number,
  containers: EditorContainer[],
  initialMatches: EditorMatch[],
  initialEdges: EditorEdge[],
  entrants: { id: number; displayName: string; seed: number | null }[],
  tbdLabel: string
) {
  const graphContainers = containers.filter((c) => c.containerType === "bracket" || (c.config as { type?: string } | null)?.type === "round_robin");
  const containerIds = new Set(graphContainers.map((c) => c.id));
  const relevantMatches = initialMatches.filter((m) => containerIds.has(m.containerId));
  const relevantEdges = initialEdges.filter((e) => relevantMatches.some((m) => m.id === e.fromMatchId));

  const layoutInputMatches = relevantMatches.map((m) => ({ id: String(m.id), containerId: String(m.containerId), round: m.round, displayOrder: m.displayOrder }));
  const containerOrder = graphContainers.map((c) => String(c.id));
  const layout = layoutEditorGrid(layoutInputMatches, containerOrder, LAYOUT_OPTS);

  const nodes: Node<MatchNodeData>[] = relevantMatches.map((m) => {
    const slotA = slotSourceFromEditorMatch(m, "a", initialEdges);
    const slotB = slotSourceFromEditorMatch(m, "b", initialEdges);

    return {
      id: String(m.id),
      type: "matchNode",
      position: layout.positions.get(String(m.id)) ?? { x: 0, y: 0 },
      data: {
        containerId: m.containerId,
        containerName: graphContainers.find((c) => c.id === m.containerId)?.name ?? "",
        round: m.round,
        label: m.label,
        bestOf: m.bestOf,
        invalid: false,
        slotA,
        slotB,
        slotALabel: entrantLabel(m.entrantAId, entrants, tbdLabel),
        slotBLabel: entrantLabel(m.entrantBId, entrants, tbdLabel),
        entrantOptions: entrants,
        onSetSlot: () => {},
        onDelete: () => {},
        readOnly: false,
        matchHref: `/admin/tournaments/${tournamentId}/matches/${m.id}`,
        scheduledAt: m.scheduledAt,
      },
    };
  });

  const edges: Edge[] = relevantEdges.map((e) => ({
    id: `${e.fromMatchId}:${e.fromResult}->${e.toMatchId}:${e.toSlot}`,
    source: String(e.fromMatchId),
    sourceHandle: e.fromResult,
    target: String(e.toMatchId),
    targetHandle: e.toSlot,
    // Curved (default bezier), not "step" — kept for the admin editor per
    // explicit user preference (public bracket display uses orthogonal
    // "step" edges instead, a deliberately different look).
    type: "deletable",
    animated: false,
    style: { stroke: e.fromResult === "winner" ? "#10b981" : "#f43f5e" },
  }));

  return { nodes, edges, graphContainers, layout };
}

function BracketEditorCanvasInner({
  tournamentId,
  stageId,
  stageStatus,
  containers,
  initialMatches,
  initialEdges,
  entrants,
}: {
  tournamentId: number;
  stageId: number;
  stageStatus: "pending" | "active" | "completed";
  containers: EditorContainer[];
  initialMatches: EditorMatch[];
  initialEdges: EditorEdge[];
  entrants: { id: number; displayName: string; seed: number | null }[];
}) {
  const t = useTranslations("admin.tournaments.editor");
  const router = useRouter();
  const readOnly = stageStatus !== "pending";

  const tbdLabel = t("tbdLabel");
  const initial = useMemo(
    () => buildInitialGraph(tournamentId, containers, initialMatches, initialEdges, entrants, tbdLabel),
    [tournamentId, containers, initialMatches, initialEdges, entrants, tbdLabel]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MatchNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [isSaving, setIsSaving] = useState(false);
  const [nextNewId, setNextNewId] = useState(1);
  const [addContainerId, setAddContainerId] = useState<number | null>(initial.graphContainers[0]?.id ?? null);
  const [addRound, setAddRound] = useState("1");
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);

  const setSlot = useCallback(
    (nodeId: string, slot: "a" | "b", source: EditorSlotSource) => {
      setEdges((prev) => prev.filter((e) => !(e.target === nodeId && e.targetHandle === slot)));
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  slotA: slot === "a" ? source : n.data.slotA,
                  slotB: slot === "b" ? source : n.data.slotB,
                  slotALabel: slot === "a" && source.type === "entrant" ? entrantLabel(source.entrantId, entrants, tbdLabel) : n.data.slotALabel,
                  slotBLabel: slot === "b" && source.type === "entrant" ? entrantLabel(source.entrantId, entrants, tbdLabel) : n.data.slotBLabel,
                },
              }
            : n
        )
      );
    },
    [setEdges, setNodes, entrants, tbdLabel]
  );

  // A match is only actually removed once the pending confirm dialog is
  // accepted (deleteNode below) — this just opens it. The node stays in
  // local editor state until then, so cancelling is a no-op.
  const requestDeleteNode = useCallback((nodeId: string) => setPendingDeleteNodeId(nodeId), []);

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setPendingDeleteNodeId(null);
    },
    [setNodes, setEdges]
  );

  // Removing a link doesn't just drop the edge — the match it fed goes back
  // to an unset (TBD) slot, otherwise its data would still say "fed by
  // edge" with no edge left to back that up.
  const deleteEdge = useCallback(
    (edge: Edge) => {
      setEdges((prev) => prev.filter((e) => e.id !== edge.id));
      setNodes((prev) =>
        prev.map((n) =>
          n.id === edge.target
            ? {
                ...n,
                data: {
                  ...n.data,
                  slotA: edge.targetHandle === "a" ? { type: "unset" as const } : n.data.slotA,
                  slotB: edge.targetHandle === "b" ? { type: "unset" as const } : n.data.slotB,
                },
              }
            : n
        )
      );
    },
    [setEdges, setNodes]
  );

  // Nodes are built once from server data; wire the (stable) setSlot callback in.
  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, onSetSlot: (slot: "a" | "b", source: EditorSlotSource) => setSlot(n.id, slot, source), onDelete: () => requestDeleteNode(n.id), readOnly },
      })),
    [nodes, setSlot, requestDeleteNode, readOnly]
  );

  const edgesWithHandlers = useMemo(
    () => edges.map((e) => ({ ...e, type: "deletable", data: { onDelete: () => deleteEdge(e), readOnly } as DeletableEdgeData })),
    [edges, deleteEdge, readOnly]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      const targetSlot = connection.targetHandle as "a" | "b";
      setEdges((prev) =>
        addEdge(
          { ...connection, type: "deletable", style: { stroke: connection.sourceHandle === "winner" ? "#10b981" : "#f43f5e" } },
          prev.filter((e) => !(e.target === connection.target && e.targetHandle === targetSlot))
        )
      );
      setNodes((prev) =>
        prev.map((n) => (n.id === connection.target ? { ...n, data: { ...n.data, slotA: targetSlot === "a" ? { type: "edge" } : n.data.slotA, slotB: targetSlot === "b" ? { type: "edge" } : n.data.slotB } } : n))
      );
    },
    [readOnly, setEdges, setNodes]
  );

  const resolveContainerId = useCallback(
    (nodeId: string): number | null => {
      const node = nodes.find((n) => n.id === nodeId);
      return node?.data.containerId ?? null;
    },
    [nodes]
  );

  // Grid columns are strictly per-container round numbers (cf.
  // lib/bracket-editor-layout.ts) — dragging a match snaps both its round
  // (x) and its row within that round (y) to the grid instead of leaving
  // it at an arbitrary pixel offset, so it's never ambiguous which column
  // (round) a match belongs to (2026-09-11 user report).
  const onNodeDragStop: OnNodeDrag<Node<MatchNodeData>> = useCallback(
    (_event, node) => {
      if (readOnly || node.type !== "matchNode") return;
      const containerId = resolveContainerId(node.id);
      if (containerId === null) return;
      const snapped = snapToGrid(node.position.x, node.position.y, String(containerId), initial.layout, LAYOUT_OPTS);
      setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, position: { x: snapped.x, y: snapped.y }, data: { ...n.data, round: snapped.round } } : n))
      );
    },
    [readOnly, resolveContainerId, initial.layout, setNodes]
  );

  const currentGraph: BracketGraph = useMemo(
    () => ({
      matches: nodesWithHandlers.map(
        (n): EngineMatchNode => ({
          id: n.id,
          containerId: String(resolveContainerId(n.id) ?? "?"),
          round: n.data.round,
          label: n.data.label ?? undefined,
          bestOf: 1,
          status: "pending",
          seeds: [
            ...(n.data.slotA.type === "entrant" ? [{ slot: "a" as const, source: { type: "seed" as const, seed: n.data.slotA.entrantId } }] : []),
            ...(n.data.slotA.type === "bye" ? [{ slot: "a" as const, source: { type: "bye" as const } }] : []),
            ...(n.data.slotB.type === "entrant" ? [{ slot: "b" as const, source: { type: "seed" as const, seed: n.data.slotB.entrantId } }] : []),
            ...(n.data.slotB.type === "bye" ? [{ slot: "b" as const, source: { type: "bye" as const } }] : []),
          ],
        })
      ),
      edges: edges.map((e) => ({ fromMatchId: e.source, fromResult: e.sourceHandle as "winner" | "loser", toMatchId: e.target, toSlot: e.targetHandle as "a" | "b" })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesWithHandlers, edges]
  );

  const validation = useMemo(() => validateEditorGraph(currentGraph), [currentGraph]);
  const invalidNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const err of validation.errors) {
      const match = /^match (\S+) /.exec(err);
      if (match) ids.add(match[1]!);
    }
    return ids;
  }, [validation]);

  // Round headers: one per (container, round) present, plus one extra
  // trailing column per container so there's always an obvious place to
  // drag a match into "the next round". Recomputed from *live* node state
  // (not just the initial server snapshot) so a round created purely by
  // dragging shows a header immediately, before saving.
  const roundHeaderNodes: Node<RoundHeaderNodeData>[] = useMemo(() => {
    const roundsByContainer = new Map<number, Set<number>>();
    for (const n of nodesWithHandlers) {
      const containerId = resolveContainerId(n.id);
      if (containerId === null) continue;
      const set = roundsByContainer.get(containerId) ?? new Set<number>();
      set.add(n.data.round);
      roundsByContainer.set(containerId, set);
    }

    const commonScheduledAt = new Map<string, string | null>();
    for (const m of initialMatches) {
      const key = `${m.containerId}:${m.round}`;
      if (!commonScheduledAt.has(key)) {
        commonScheduledAt.set(key, m.scheduledAt);
      } else if (commonScheduledAt.get(key) !== m.scheduledAt) {
        commonScheduledAt.set(key, null);
      }
    }

    const result: Node<RoundHeaderNodeData>[] = [];
    for (const container of initial.graphContainers) {
      const rounds = roundsByContainer.get(container.id) ?? new Set<number>();
      const maxRound = rounds.size > 0 ? Math.max(...rounds) : 0;
      const laneBaseY = initial.layout.laneOffsetY.get(String(container.id)) ?? 0;
      for (let round = 1; round <= maxRound + 1; round++) {
        result.push({
          id: `round-header-${container.id}-${round}`,
          type: "roundHeaderNode",
          position: { x: (round - 1) * LAYOUT_OPTS.columnWidth, y: laneBaseY },
          draggable: false,
          selectable: false,
          // Fixed, known size — these nodes are rebuilt into a fresh object
          // every time this memo runs, which (per @xyflow/system's
          // adoptUserNodes) resets `measured` to undefined on each such
          // rebuild unless the node object is referentially stable across
          // renders. Declaring width/height up front makes `hasDimensions`
          // true immediately instead of depending on the async
          // ResizeObserver round-trip ever "winning the race" — without
          // this the node exists in the DOM but stays permanently
          // `visibility: hidden` (found via live testing, 2026-09-11).
          width: HEADER_NODE_WIDTH,
          height: HEADER_NODE_HEIGHT,
          data: { containerId: container.id, stageId, round, commonScheduledAt: commonScheduledAt.get(`${container.id}:${round}`) ?? null },
        });
      }
    }
    return result;
  }, [nodesWithHandlers, resolveContainerId, initialMatches, initial.graphContainers, initial.layout]);

  const displayNodes: CanvasNode[] = useMemo(
    () => [...nodesWithHandlers.map((n) => ({ ...n, data: { ...n.data, invalid: invalidNodeIds.has(n.id) } })), ...roundHeaderNodes],
    [nodesWithHandlers, invalidNodeIds, roundHeaderNodes]
  );

  // Adapters: the managed node state (useNodesState) only ever tracks
  // matchNode entries — round headers are recomputed fresh every render
  // (see roundHeaderNodes above) and never selectable/draggable, so any
  // change reported for one is simply dropped here rather than applied.
  const handleNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      const matchChanges = changes.filter((c) => "id" in c && nodes.some((n) => n.id === c.id)) as NodeChange<Node<MatchNodeData>>[];
      onNodesChange(matchChanges);
    },
    [onNodesChange, nodes]
  );
  const handleNodeDragStop: OnNodeDrag<CanvasNode> = useCallback(
    (event, node, draggedNodes) => {
      if (node.type !== "matchNode") return;
      onNodeDragStop(event, node as Node<MatchNodeData>, draggedNodes.filter((n): n is Node<MatchNodeData> => n.type === "matchNode"));
    },
    [onNodeDragStop]
  );

  // The delete-link button on each edge (DeletableEdge) already resets the
  // fed slot back to "unset" — this covers the other way to remove an edge
  // (select it, press Backspace/Delete) so both paths keep node data in sync
  // with what edges actually still exist.
  const handleEdgesChange: OnEdgesChange<Edge> = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type !== "remove") continue;
        const removedEdge = edges.find((e) => e.id === change.id);
        if (removedEdge) deleteEdge(removedEdge);
      }
      onEdgesChange(changes.filter((c) => c.type !== "remove"));
    },
    [edges, deleteEdge, onEdgesChange]
  );

  function addMatch() {
    if (addContainerId === null) return;
    const container = containers.find((c) => c.id === addContainerId);
    const round = Number(addRound) || 1;
    const id = `new-${nextNewId}`;
    setNextNewId((n) => n + 1);

    const existingInColumn = nodes.filter((n) => resolveContainerId(n.id) === addContainerId && n.data.round === round).length;
    const laneBaseY = initial.layout.laneOffsetY.get(String(addContainerId)) ?? 0;
    const position = { x: (round - 1) * LAYOUT_OPTS.columnWidth, y: laneBaseY + LAYOUT_OPTS.headerHeight + existingInColumn * LAYOUT_OPTS.rowHeight };

    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "matchNode",
        position,
        data: {
          containerId: addContainerId,
          containerName: container?.name ?? "",
          round,
          label: null,
          bestOf: 1,
          invalid: false,
          slotA: { type: "unset" } as EditorSlotSource,
          slotB: { type: "unset" } as EditorSlotSource,
          slotALabel: tbdLabel,
          slotBLabel: tbdLabel,
          entrantOptions: entrants,
          onSetSlot: () => {},
          onDelete: () => {},
          readOnly: false,
          matchHref: null,
          scheduledAt: null,
        },
      },
    ]);
  }

  async function handleSave() {
    setIsSaving(true);
    const payload = {
      stageId,
      containerIds: initial.graphContainers.map((c) => c.id),
      matches: nodesWithHandlers.map((n) => {
        const containerId = resolveContainerId(n.id) ?? 0;
        return {
          id: n.id,
          containerId,
          round: n.data.round,
          displayOrder: rowIndexFromY(n.position.y, String(containerId), initial.layout, LAYOUT_OPTS),
          label: n.data.label ?? null,
          bestOf: n.data.bestOf,
          slotA: n.data.slotA,
          slotB: n.data.slotB,
        };
      }),
      edges: currentGraph.edges,
    };
    const result = await saveManualGraph(payload);
    setIsSaving(false);
    if (!result.ok) {
      toast.error(t(`error.${result.error}`));
      return;
    }
    toast.success(t("saveSuccess"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {readOnly && <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("readOnlyNotice")}</p>}

      {!readOnly && <GenerateTemplateForm stageId={stageId} seededEntrants={entrants.filter((e): e is { id: number; seed: number; displayName: string } => e.seed !== null)} onGenerated={() => router.refresh()} />}

      {!readOnly && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("addMatchLabel")}</span>
          <Select
            items={Object.fromEntries(initial.graphContainers.map((c) => [String(c.id), c.name]))}
            value={addContainerId !== null ? String(addContainerId) : undefined}
            onValueChange={(v) => v && setAddContainerId(Number(v))}
          >
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {initial.graphContainers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" min={1} className="h-8 w-20" value={addRound} onChange={(e) => setAddRound(e.target.value)} />
          <Button variant="outline" size="sm" onClick={addMatch}>
            {t("addMatchButton")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("addMatchTbdHint")}</span>
        </div>
      )}

      <div className="gcs-flow-canvas h-[600px] rounded-md border">
        <style>{CONTROLS_DARK_STYLE}</style>
        <ReactFlow<CanvasNode>
          nodes={displayNodes}
          edges={edgesWithHandlers}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeDragStop={handleNodeDragStop}
          nodesConnectable={!readOnly}
          nodesDraggable={!readOnly}
          elementsSelectable={!readOnly}
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

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isSaving || !validation.valid}>
            {isSaving ? t("saving") : t("saveButton")}
          </Button>
          {!validation.valid && <span className="text-sm text-destructive">{t("validationErrors", { count: validation.errors.length })}</span>}
          {validation.valid && <span className="text-sm text-emerald-600">{t("validationOk")}</span>}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteNodeId !== null}
        onOpenChange={(open) => !open && setPendingDeleteNodeId(null)}
        title={t("deleteMatchTitle")}
        description={t("deleteMatchConfirm")}
        confirmLabel={t("deleteMatchConfirmButton")}
        cancelLabel={t("cancel")}
        onConfirm={() => pendingDeleteNodeId && deleteNode(pendingDeleteNodeId)}
      />
    </div>
  );
}
