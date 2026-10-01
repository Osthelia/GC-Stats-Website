/**
 * GC-Stats - match-h2h-radar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { HeadToHeadMapRow } from "@/lib/match-page-data";

function H2hTooltip({ active, payload, label, colorA, colorB }: { active?: boolean; payload?: { dataKey: string; value: number; payload: HeadToHeadMapRow }[]; label?: string; colorA: string; colorB: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-3 py-2 text-[11px] shadow-xl">
      <div className="mb-1 font-bold text-neutral-200">{label}</div>
      <div className="flex items-center gap-1.5" style={{ color: colorA }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorA }} />
        {row.teamA.wins}/{row.teamA.timesPlayed} ({row.teamA.winPct}%)
      </div>
      <div className="flex items-center gap-1.5" style={{ color: colorB }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorB }} />
        {row.teamB.wins}/{row.teamB.timesPlayed} ({row.teamB.winPct}%)
      </div>
    </div>
  );
}

export function MatchH2hRadar({ rows, nameA, nameB, colorA, colorB }: { rows: HeadToHeadMapRow[]; nameA: string; nameB: string; colorA: string; colorB: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={rows} outerRadius="70%">
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="mapName" tick={{ fill: "#8a8a8f", fontSize: 10, fontFamily: "monospace" }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#4a4a50", fontSize: 9 }} tickCount={5} />
        <Radar name={nameA} dataKey="teamA.winPct" stroke={colorA} fill={colorA} fillOpacity={0.18} strokeWidth={2} />
        <Radar name={nameB} dataKey="teamB.winPct" stroke={colorB} fill={colorB} fillOpacity={0.18} strokeWidth={2} />
        <Tooltip content={<H2hTooltip colorA={colorA} colorB={colorB} />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
