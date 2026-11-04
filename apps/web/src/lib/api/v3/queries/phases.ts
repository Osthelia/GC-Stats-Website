/**
 * GC-Stats - phases
 *
 * Resolves the `phase_id` of V1/V2 match entries into the V3 `phase` object
 * (id, name, type, status, order, dates), batched in two queries per response.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { stages, stageContainers, matches } from "@gc-stats/db";

/** Format of a phase's containers, `mixed` when it holds several different ones. */
export type ApiPhaseType = "bracket" | "swiss" | "round_robin" | "group" | "set" | "mixed";
export type ApiContainerType = Exclude<ApiPhaseType, "mixed">;

export type ApiPhase = {
  id: number;
  name: string;
  type: ApiPhaseType | null;
  status: string;
  order: number;
  start_date: string | null;
  end_date: string | null;
  liquipedia_link: string | null;
};

/** A group container is either swiss or round robin depending on its config, `group` when the config is unreadable. */
export function toContainerFormat(containerType: "bracket" | "group" | "set", config: unknown): ApiContainerType {
  if (containerType !== "group") return containerType;
  const type = config && typeof config === "object" ? (config as { type?: unknown }).type : null;
  return type === "swiss" || type === "round_robin" ? type : "group";
}

function toPhaseType(formats: ApiContainerType[]): ApiPhaseType | null {
  // A set only wraps other containers, so it only counts when nothing else is there.
  const concrete = formats.filter((f) => f !== "set");
  const distinct = new Set(concrete.length > 0 ? concrete : formats);
  if (distinct.size === 0) return null;
  return distinct.size === 1 ? [...distinct][0]! : "mixed";
}

export async function getPhasesByIds(ids: number[]): Promise<Map<number, ApiPhase>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const [stageRows, containerRows] = await Promise.all([
    db.select().from(stages).where(inArray(stages.id, uniqueIds)),
    db
      .select({ stageId: stageContainers.stageId, containerType: stageContainers.containerType, config: stageContainers.config })
      .from(stageContainers)
      .where(inArray(stageContainers.stageId, uniqueIds))
      .orderBy(asc(stageContainers.id)),
  ]);

  const formatsByStage = new Map<number, ApiContainerType[]>();
  for (const c of containerRows) {
    const list = formatsByStage.get(c.stageId) ?? [];
    list.push(toContainerFormat(c.containerType, c.config));
    formatsByStage.set(c.stageId, list);
  }

  return new Map(
    stageRows.map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        type: toPhaseType(formatsByStage.get(s.id) ?? []),
        status: s.status,
        order: s.sequenceOrder,
        start_date: s.startDate,
        end_date: s.endDate,
        liquipedia_link: s.liquipediaLink,
      },
    ]),
  );
}

export type ApiContainerPathItem = { id: number; name: string; type: ApiContainerType };

/** A container with its full chain of sets, outermost first and itself last (e.g. Group Stage, Group A, Lower Bracket). */
export type ApiContainerRef = ApiContainerPathItem & { path: ApiContainerPathItem[] };

const MAX_CONTAINER_DEPTH = 10;

/** Resolves containers and every set above them, one query per nesting level. */
export async function getContainerRefs(containerIds: number[]): Promise<Map<number, ApiContainerRef>> {
  const known = new Map<number, ApiContainerPathItem & { parentId: number | null }>();
  let pending = [...new Set(containerIds)];

  for (let depth = 0; pending.length > 0 && depth < MAX_CONTAINER_DEPTH; depth++) {
    const rows = await db
      .select({ id: stageContainers.id, name: stageContainers.name, containerType: stageContainers.containerType, config: stageContainers.config, parentId: stageContainers.parentId })
      .from(stageContainers)
      .where(inArray(stageContainers.id, pending));
    for (const r of rows) known.set(r.id, { id: r.id, name: r.name, type: toContainerFormat(r.containerType, r.config), parentId: r.parentId });
    pending = [...new Set(rows.map((r) => r.parentId).filter((id): id is number => id != null && !known.has(id)))];
  }

  const refs = new Map<number, ApiContainerRef>();
  for (const id of new Set(containerIds)) {
    const chain: ApiContainerPathItem[] = [];
    const seen = new Set<number>();
    for (let cur = known.get(id); cur && !seen.has(cur.id); cur = cur.parentId != null ? known.get(cur.parentId) : undefined) {
      if (chain.length >= MAX_CONTAINER_DEPTH) {
        console.error("[api v3 phases] container chain too deep (container #%d)", id);
        break;
      }
      seen.add(cur.id);
      chain.unshift({ id: cur.id, name: cur.name, type: cur.type });
    }
    const top = chain[0] ? known.get(chain[0].id) : undefined;
    if (top?.parentId != null) console.error("[api v3 phases] broken container chain (container #%d, missing parent #%d)", id, top.parentId);
    const self = chain[chain.length - 1];
    if (self) refs.set(id, { ...self, path: chain });
  }
  return refs;
}

type MatchWithPhaseId = { id: number; phase_id: number | null };
export type WithPhase<T extends MatchWithPhaseId> = Omit<T, "phase_id"> & { phase: ApiPhase | null; container: ApiContainerRef | null };

/** Swaps `phase_id` for the full `phase` object and adds the match's `container` on a single entry. */
export async function withPhase<T extends MatchWithPhaseId>(item: T): Promise<WithPhase<T>> {
  const [result] = await withPhases([item]);
  return result!;
}

/** Same as `withPhase` for many matches, resolving all phases and containers at once. */
export async function withPhases<T extends MatchWithPhaseId>(items: T[]): Promise<WithPhase<T>[]> {
  if (items.length === 0) return [];
  const [phases, matchContainers] = await Promise.all([
    getPhasesByIds(items.map((i) => i.phase_id).filter((id): id is number => id != null)),
    db.select({ id: matches.id, containerId: matches.containerId }).from(matches).where(inArray(matches.id, items.map((i) => i.id))),
  ]);
  const containerIdByMatch = new Map(matchContainers.map((m) => [m.id, m.containerId]));
  const containers = await getContainerRefs([...containerIdByMatch.values()]);

  return items.map((item) => {
    const { phase_id, ...rest } = item;
    const containerId = containerIdByMatch.get(item.id);
    return {
      ...rest,
      phase: phase_id != null ? (phases.get(phase_id) ?? null) : null,
      container: containerId != null ? (containers.get(containerId) ?? null) : null,
    };
  });
}

type Paginated<T> = { page: number; per_page: number; total: number; total_pages: number; data: T[] };

/** `withPhases` applied to the `data` of a paginated response. */
export async function withPhasesPaginated<T extends MatchWithPhaseId>(result: Paginated<T> | null): Promise<Paginated<WithPhase<T>> | null> {
  if (!result) return null;
  return { ...result, data: await withPhases(result.data) };
}
