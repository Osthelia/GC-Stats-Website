/**
 * GC-Stats - tiebreaker-order
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Ordered list of tiebreakers: wins always come first, then these in the order shown
export function TiebreakerOrder({ value, options, onChange }: { value: string[]; options: readonly string[]; onChange: (next: string[]) => void }) {
  const t = useTranslations("admin.tournaments.stages.tiebreakerOrder");
  const unused = options.filter((o) => !value.includes(o));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1.5">
        <li className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground">
          <span className="w-5 text-center text-xs">1</span>
          {t("wins")}
        </li>
        {value.map((key, index) => (
          <li key={key} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
            <span className="w-5 text-center text-xs text-muted-foreground">{index + 2}</span>
            <span className="flex-1">{t(`options.${key}`)}</span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("moveUp")} disabled={index === 0} onClick={() => move(index, -1)}>
              <ArrowUpIcon />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("moveDown")} disabled={index === value.length - 1} onClick={() => move(index, 1)}>
              <ArrowDownIcon />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("remove")} onClick={() => onChange(value.filter((v) => v !== key))}>
              <XIcon />
            </Button>
          </li>
        ))}
      </ol>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unused.map((key) => (
            <Button key={key} type="button" variant="outline" size="sm" onClick={() => onChange([...value, key])}>
              <PlusIcon />
              {t(`options.${key}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
