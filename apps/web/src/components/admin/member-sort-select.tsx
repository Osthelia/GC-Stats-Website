/**
 * GC-Stats - member-sort-select
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const MEMBER_SORT_KEYS = ["name", "role", "joined", "left"] as const;
export type MemberSortKey = (typeof MEMBER_SORT_KEYS)[number];

type SortableMember = { handle: string; role: string; since: string | null; until: string | null };

/** Sorts a copy: name A-Z, role by the given list order, join/leave date most recent first (no leave date counts as most recent). */
export function sortMembers<T extends SortableMember>(members: T[], key: MemberSortKey, roleOrder: readonly string[]): T[] {
  const byName = (a: T, b: T) => a.handle.localeCompare(b.handle, undefined, { sensitivity: "base" });
  const rank = (role: string) => {
    const i = roleOrder.indexOf(role);
    return i === -1 ? roleOrder.length : i;
  };
  const compare: Record<MemberSortKey, (a: T, b: T) => number> = {
    name: byName,
    role: (a, b) => rank(a.role) - rank(b.role) || byName(a, b),
    joined: (a, b) => (b.since ?? "").localeCompare(a.since ?? "") || byName(a, b),
    left: (a, b) => (b.until ?? "9999-12-31").localeCompare(a.until ?? "9999-12-31") || byName(a, b),
  };
  return [...members].sort(compare[key]);
}

export function MemberSortSelect({ value, onChange }: { value: MemberSortKey; onChange: (value: MemberSortKey) => void }) {
  const t = useTranslations("admin.memberSort");
  const items = Object.fromEntries(MEMBER_SORT_KEYS.map((k) => [k, t(k)]));

  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground">{t("label")}</Label>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v as MemberSortKey)}>
        <SelectTrigger aria-label={t("label")} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MEMBER_SORT_KEYS.map((k) => (
            <SelectItem key={k} value={k}>
              {items[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
