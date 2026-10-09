/**
 * GC-Stats - achievements-list
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TrophyIcon, MedalIcon } from "lucide-react";
import { GOLD, tint } from "@/lib/theme-colors";
import { ordinalPlacement, placementColor } from "@/lib/ordinal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AchievementListItem = {
  key: number;
  href: string;
  label: string;
  placement: number;
  category: string | null;
  year: string;
  subtitle?: string;
};

const PREVIEW_LIMIT = 3;

type GroupKey = "championship" | "regional" | "other";

function groupOf(category: string | null): GroupKey {
  const c = category?.trim().toLowerCase();
  if (c === "championship") return "championship";
  if (c === "regional") return "regional";
  return "other";
}

function groupItems(items: AchievementListItem[]) {
  const groups: Record<GroupKey, AchievementListItem[]> = {
    championship: [],
    regional: [],
    other: [],
  };
  for (const item of items) groups[groupOf(item.category)].push(item);
  return (["championship", "regional", "other"] as const)
    .map((key) => ({ key, items: groups[key] }))
    .filter((g) => g.items.length > 0);
}

function AchievementRow({ item }: { item: AchievementListItem }) {
  const color = placementColor(item.placement);
  return (
    <Link
      href={item.href}
      className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 transition-all hover:brightness-110 active:scale-[0.98]"
      style={{ borderColor: tint(color, 0.35), background: tint(color, 0.12) }}
    >
      <span
        className="w-7 flex-none font-mono text-[10px] font-black"
        style={{ color }}
      >
        {ordinalPlacement(item.placement)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-neutral-100">
        {item.label}
      </span>
    </Link>
  );
}

const GROUP_ACCENT: Record<GroupKey, string> = {
  championship: GOLD,
  regional: "#5aa9e6",
  other: "#8f8f94",
};

const PLACE_KEYS = { 1: "firstPlace", 2: "secondPlace", 3: "thirdPlace" } as const;

function AchievementCard({ item }: { item: AchievementListItem }) {
  const color = placementColor(item.placement);
  const Icon = item.placement === 1 ? TrophyIcon : MedalIcon;
  return (
    <Link
      href={item.href}
      className="group flex min-w-0 items-center gap-3 rounded-xl border p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
      style={{
        borderColor: tint(color, 0.3),
        background: `linear-gradient(135deg, ${tint(color, 0.16)}, ${tint(color, 0.04)})`,
      }}
    >
      <div
        className="flex h-12 w-12 flex-none flex-col items-center justify-center rounded-lg"
        style={{
          background: `radial-gradient(circle at 30% 25%, ${tint(color, 0.45)}, ${tint(color, 0.15)})`,
          boxShadow: `inset 0 0 0 1px ${tint(color, 0.5)}, 0 4px 14px ${tint(color, 0.2)}`,
          color,
        }}
      >
        <Icon className="h-4 w-4" />
        <span className="font-mono text-[10px] leading-none font-black">
          {ordinalPlacement(item.placement)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-bold text-neutral-100">
          {item.label}
        </span>
        <span className="truncate font-mono text-[10px] text-neutral-500">
          {item.subtitle ? `${item.subtitle} · ${item.year}` : item.year}
        </span>
      </div>
    </Link>
  );
}

function AchievementsModalBody({ items }: { items: AchievementListItem[] }) {
  const t = useTranslations("achievements");
  const groups = groupItems(items);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        {([1, 2, 3] as const).map((place) => {
          const color = placementColor(place);
          const Icon = place === 1 ? TrophyIcon : MedalIcon;
          return (
            <div
              key={place}
              className="flex items-center gap-2.5 rounded-xl border p-3"
              style={{ borderColor: tint(color, 0.3), background: tint(color, 0.08) }}
            >
              <Icon className="h-6 w-6 flex-none" style={{ color }} />
              <div className="flex min-w-0 flex-col">
                <span className="text-2xl leading-none font-black text-neutral-100">
                  {items.filter((i) => i.placement === place).length}
                </span>
                <span className="truncate font-mono text-[10px] tracking-[0.12em] text-neutral-500 uppercase">
                  {t(PLACE_KEYS[place])}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}
      >
        {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: GROUP_ACCENT[g.key] }}
            />
            <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-neutral-300 uppercase">
              {t(g.key)}
            </span>
            <span className="font-mono text-[10px] text-neutral-600">
              {g.items.length}
            </span>
            <div
              className="h-px flex-1"
              style={{ background: tint(GROUP_ACCENT[g.key], 0.25) }}
            />
          </div>
          <div className="flex flex-col gap-2">
            {g.items.map((item) => (
              <AchievementCard key={item.key} item={item} />
            ))}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}

export function AchievementsList({ items }: { items: AchievementListItem[] }) {
  const t = useTranslations("achievements");
  const [open, setOpen] = useState(false);
  const groupCount = groupItems(items).length;

  if (items.length <= PREVIEW_LIMIT) {
    return (
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <AchievementRow key={item.key} item={item} />
        ))}
      </div>
    );
  }

  // Championship first, then regional, then the rest.
  const preview = groupItems(items)
    .flatMap((g) => g.items)
    .slice(0, PREVIEW_LIMIT);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {preview.map((item) => (
          <AchievementRow key={item.key} item={item} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-lg border border-neutral-800 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:border-[#5c4c22] hover:text-[#e4ae22] active:scale-[0.97]"
      >
        {t("viewAll", { count: items.length })}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={groupCount > 2 ? "sm:max-w-5xl" : groupCount === 2 ? "sm:max-w-3xl" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <AchievementsModalBody items={items} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
