/**
 * GC-Stats - match-h2h-graph
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { HeadToHeadMapRow, MatchSide } from "@/lib/match-page-data";

const COLOR_A = "#4ade80";
const COLOR_B = "#f87171";

// Recharts is only loaded on the client, once the card is rendered.
const MatchH2hRadar = dynamic(() => import("@/components/match/match-h2h-radar").then((m) => m.MatchH2hRadar), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-neutral-500" />
    </div>
  ),
});

export function MatchH2hGraph({
  a,
  b,
  rows,
  title,
  emptyLabel,
  winLabel,
  bare = false,
}: {
  a: MatchSide;
  b: MatchSide;
  rows: HeadToHeadMapRow[];
  title: string;
  emptyLabel: string;
  winLabel: string;
  /** Drops the card chrome (border/background/header) so the chart fills its container (used by the standalone OBS broadcast widget). */
  bare?: boolean;
}) {
  const chart =
    rows.length === 0 ? (
      <p className="px-2 py-8 text-center text-xs text-neutral-600">{emptyLabel}</p>
    ) : (
      <div className="mx-auto" style={{ maxWidth: 420, height: 360 }}>
        <MatchH2hRadar rows={rows} nameA={a.shortName ?? a.displayName} nameB={b.shortName ?? b.displayName} colorA={COLOR_A} colorB={COLOR_B} />
      </div>
    );

  if (bare) {
    return (
      <div className="flex h-full w-full flex-col p-3" role="img" aria-label={`${a.shortName ?? a.displayName} vs ${b.shortName ?? b.displayName}: ${title}`}>
        <div className="flex items-center justify-between gap-3 px-1 pb-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: COLOR_A }} />
            <span className="truncate text-[11px] font-bold tracking-tight text-neutral-200 uppercase">{a.shortName ?? a.displayName}</span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <span className="truncate text-[11px] font-bold tracking-tight text-neutral-200 uppercase">{b.shortName ?? b.displayName}</span>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: COLOR_B }} />
          </div>
        </div>
        {chart}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-2)" }}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3.5">
        <span className="text-[10px] font-black tracking-[0.25em] text-neutral-500 uppercase">{title}</span>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COLOR_A }} />
          <span className="truncate text-[12px] font-bold tracking-tight text-neutral-200 uppercase">{a.shortName ?? a.displayName}</span>
        </div>
        <span className="flex-none font-mono text-[9px] font-black tracking-widest text-neutral-500 uppercase">{winLabel}</span>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-[12px] font-bold tracking-tight text-neutral-200 uppercase">{b.shortName ?? b.displayName}</span>
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COLOR_B }} />
        </div>
      </div>

      <div className="p-3">{chart}</div>
    </div>
  );
}
