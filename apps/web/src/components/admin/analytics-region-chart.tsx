/**
 * GC-Stats - analytics-region-chart
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";
import { REGIONS, type Region } from "@/lib/geo";

// Categorical palette, dark-surface validated (adjacent-pair CVD ΔE ≥ 8.4) —
// slots 1-4 (blue/orange/aqua/yellow) of the shared data-viz categorical order.
const REGION_COLORS: Record<Region, string> = {
  EURO: "#3987e5",
  AMER: "#d95926",
  APAC: "#199e70",
  OTHE: "#c98500",
};

type ChartPoint = { date: string } & Record<Region, number>;

function RegionTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: Region; value: number; color: string }[]; label?: string }) {
  const t = useTranslations("admin.analytics");
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          {t(`region.${p.dataKey}`)}: {p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export function AnalyticsRegionChart({ labels, series, titleId }: { labels: string[]; series: Record<Region, number[]>; titleId?: string }) {
  const t = useTranslations("admin.analytics");
  const data: ChartPoint[] = labels.map((date, i) => {
    const point = { date: date.slice(5) } as ChartPoint;
    for (const region of REGIONS) point[region] = series[region][i] ?? 0;
    return point;
  });

  const isEmpty = REGIONS.every((r) => series[r].every((v) => v === 0));
  if (isEmpty) {
    return <p className="px-2 py-12 text-center text-sm text-muted-foreground">{t("chartEmpty")}</p>;
  }

  return (
    <div style={{ height: 280 }} role="img" aria-labelledby={titleId}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={4} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
          <Tooltip content={<RegionTooltip />} />
          <Legend
            formatter={(value: string) => <span className="text-xs text-muted-foreground">{t(`region.${value}`)}</span>}
            iconType="circle"
            iconSize={8}
          />
          {REGIONS.map((region) => (
            <Line key={region} type="monotone" dataKey={region} stroke={REGION_COLORS[region]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
