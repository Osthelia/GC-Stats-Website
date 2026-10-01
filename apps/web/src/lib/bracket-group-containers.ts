/**
 * GC-Stats - bracket-group-containers
 *
 * Splits a stage's bracket-shaped containers into independent physical
 * brackets, so e.g. 8 parallel Group A-H double-elim brackets under one
 * "Open Qualifier" stage render as 8 separate canvases (tabs) instead of
 * being merged into a single giant one.
 *
 * Cannot use `bracket_edges` connectivity for this: a double/triple-elim
 * upper-to-lower drop-in edge is a known, accepted gap in the V1 migration
 * backfill (`packages/db/scripts/migrate-v1/13-bracket-edges.ts`), even a
 * single group's own Upper and Lower bracket have zero edges connecting
 * them today, so edge connectivity would wrongly split every group's
 * Upper/Lower into two separate "brackets" instead of merging them.
 *
 * Uses the container naming convention from the V1 migration's phase-tree
 * resolver instead (`packages/db/scripts/migrate-v1/phase-tree.ts`): a
 * container inheriting a grouping ancestor is named "<ancestor path> -
 * <own name>" (e.g. "Group A - Upper Bracket"). Everything but the last
 * " - " segment is the group key. A container with no such prefix (the
 * common case, a stage's single physical bracket, e.g. plain "Upper
 * Bracket"/"Lower Bracket"/"Grand Final") falls into one shared ungrouped
 * bucket, keeping today's single-canvas rendering for that case unchanged.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export interface BracketContainerGroup<T> {
  key: string;
  label: string;
  containers: T[];
}

export function groupBracketContainers<T extends { name: string }>(containers: T[]): BracketContainerGroup<T>[] {
  const prefixOf = (name: string) => {
    const segments = name.split(" - ");
    return segments.length > 1 ? segments.slice(0, -1).join(" - ") : "";
  };

  const order: string[] = [];
  const buckets = new Map<string, T[]>();
  for (const c of containers) {
    const prefix = prefixOf(c.name);
    if (!buckets.has(prefix)) {
      buckets.set(prefix, []);
      order.push(prefix);
    }
    buckets.get(prefix)!.push(c);
  }

  return order.map((prefix) => ({ key: prefix || "__root__", label: prefix, containers: buckets.get(prefix)! }));
}
