/**
 * GC-Stats - structure-dnd
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { GripVerticalIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { moveContainerToSet } from "@/actions/admin-containers";

export interface DndNode {
  id: number;
  name: string;
  parentId: number | null;
}

interface DndState {
  enabled: boolean;
  activeId: number | null;
  // Containers the dragged one cannot be dropped in: itself and everything nested in it
  blocked: ReadonlySet<number>;
  // Where the dragged container sits now
  current: { parentId: number | null; index: number } | null;
}

const Ctx = createContext<DndState>({ enabled: false, activeId: null, blocked: new Set(), current: null });
export const useStructureDnd = () => useContext(Ctx);

const slotId = (parentId: number | null, index: number) => `slot|${parentId ?? ""}|${index}`;

// The drop slot closest to the pointer wins, so a drop never needs a precise aim
const nearestSlot: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableContainers, droppableRects } = args;
  if (!pointerCoordinates) return closestCenter(args);
  let best: { id: string | number; distance: number } | null = null;
  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const dx = Math.max(rect.left - pointerCoordinates.x, 0, pointerCoordinates.x - rect.right);
    const dy = Math.max(rect.top - pointerCoordinates.y, 0, pointerCoordinates.y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) best = { id: container.id, distance };
  }
  return best ? [{ id: best.id }] : [];
};

/** Drag and drop of the containers of a stage: reorder them, put them in a set or take them out of one. */
export function StructureDnd({ stageId, nodes, enabled, children }: { stageId: number; nodes: DndNode[]; enabled: boolean; children: ReactNode }) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const state = useMemo<DndState>(() => {
    const active = activeId !== null ? byId.get(activeId) : undefined;
    const blocked = new Set<number>();
    if (active) {
      blocked.add(active.id);
      for (let grew = true; grew; ) {
        grew = false;
        for (const n of nodes) {
          if (n.parentId !== null && blocked.has(n.parentId) && !blocked.has(n.id)) {
            blocked.add(n.id);
            grew = true;
          }
        }
      }
    }
    const current = active ? { parentId: active.parentId, index: nodes.filter((n) => n.parentId === active.parentId).findIndex((n) => n.id === active.id) } : null;
    return { enabled, activeId, blocked, current };
  }, [enabled, activeId, byId, nodes]);

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const over = event.over ? String(event.over.id) : null;
    const node = byId.get(Number(event.active.id));
    if (!over?.startsWith("slot|") || !node) return;
    const [, rawParent = "", rawIndex = "0"] = over.split("|");
    const parentId = rawParent ? Number(rawParent) : null;
    let index = Number(rawIndex);
    // The slots count the dragged container itself, taking it out shifts the ones after it
    if (parentId === node.parentId && nodes.filter((n) => n.parentId === parentId).findIndex((n) => n.id === node.id) < index) index -= 1;
    startTransition(async () => {
      const result = await moveContainerToSet(node.id, stageId, parentId, index);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
    });
  }

  const nameOf = (id: string | number) => byId.get(Number(id))?.name ?? "";

  return (
    <Ctx.Provider value={state}>
      <DndContext
        id={`structure-dnd-${stageId}`}
        sensors={sensors}
        collisionDetection={nearestSlot}
        onDragStart={(e: DragStartEvent) => setActiveId(Number(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          screenReaderInstructions: { draggable: t("dndInstructions") },
          announcements: {
            onDragStart: ({ active }) => t("dndPicked", { name: nameOf(active.id) }),
            onDragOver: () => undefined,
            onDragEnd: ({ active }) => t("dndDropped", { name: nameOf(active.id) }),
            onDragCancel: ({ active }) => t("dndCancelled", { name: nameOf(active.id) }),
          },
        }}
      >
        <div className={cn("relative transition-opacity", pending && "opacity-60")} aria-busy={pending}>
          {children}
          {pending && <Loader2Icon className="absolute top-2 right-2 size-4 animate-spin text-muted-foreground" />}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeId !== null && <div className="w-fit rounded-lg border border-primary bg-card px-3 py-2 text-sm font-semibold shadow-lg">{nameOf(activeId)}</div>}
        </DragOverlay>
      </DndContext>
    </Ctx.Provider>
  );
}

/** A place where the dragged container can land: index n is before the nth sibling of the parent. */
export function DropSlot({ parentId, index, empty = false }: { parentId: number | null; index: number; empty?: boolean }) {
  const t = useTranslations("admin.tournaments.stages");
  const { activeId, blocked, current } = useStructureDnd();
  // Dropping where the container already is changes nothing
  const noop = current !== null && current.parentId === parentId && (index === current.index || index === current.index + 1);
  const disabled = activeId === null || (parentId !== null && blocked.has(parentId)) || noop;
  const { setNodeRef, isOver } = useDroppable({ id: slotId(parentId, index), disabled });

  if (empty) {
    // The node stays mounted so the set can be dropped on, the hint only shows while a container is dragged
    const visible = activeId !== null && !disabled;
    return (
      <div ref={setNodeRef} className={cn("rounded-lg border border-dashed text-xs transition-colors", visible ? "border-primary/60 px-3 py-2 text-muted-foreground" : "h-0 overflow-hidden border-transparent", isOver && "border-primary bg-primary/10 text-foreground")}>
        {visible && t("dndDropHere")}
      </div>
    );
  }
  return (
    <div ref={setNodeRef} className="flex h-2 items-center" aria-hidden="true">
      <div className={cn("h-0.5 w-full rounded-full transition-colors", activeId !== null && !disabled && "bg-primary/25", isOver && "h-1 bg-primary")} />
    </div>
  );
}

/** The grip that starts a drag, the whole row follows. */
export function DragHandle({ id, name }: { id: number; name: string }) {
  const t = useTranslations("admin.tournaments.stages");
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  return (
    <Button ref={setNodeRef} type="button" variant="ghost" size="icon-sm" className="cursor-grab touch-none active:cursor-grabbing" aria-label={t("dndHandle", { name })} title={t("dndHandle", { name })} {...attributes} {...listeners}>
      <GripVerticalIcon />
    </Button>
  );
}
