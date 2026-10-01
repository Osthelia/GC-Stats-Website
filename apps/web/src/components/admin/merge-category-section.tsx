/**
 * GC-Stats - merge-category-section
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export type MergeCategoryItem = { id: string; label: ReactNode };

/**
 * One data category in the team/player merge form (roster, tournaments,
 * news, logos, match stats...) — a "select all" header checkbox plus one
 * checkbox per item. Shared by team-merge-form.tsx and player-merge-form.tsx
 * so the two merge UIs don't each reinvent the same checkbox-list pattern
 * (CLAUDE.md reusable-component rule) — renders nothing when there's
 * nothing in this category to move, same as V1's @if($items->isNotEmpty()).
 */
export function MergeCategorySection({
  title,
  hint,
  items,
  selected,
  onToggle,
  onToggleAll,
}: {
  title: string;
  hint?: string;
  items: MergeCategoryItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  if (items.length === 0) return null;

  const selectedCount = items.filter((item) => selected.has(item.id)).length;
  const allSelected = selectedCount === items.length;

  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox checked={allSelected} onCheckedChange={(checked) => onToggleAll(checked === true)} />
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <div className="mt-3 grid max-h-96 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {items.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <Checkbox checked={selected.has(item.id)} onCheckedChange={() => onToggle(item.id)} />
            <span className="truncate">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
