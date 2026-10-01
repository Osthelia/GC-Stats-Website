/**
 * GC-Stats - api-key-daily-chart
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";

type DailyPoint = { date: string; requests: number; errors: number };

function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  const t = useTranslations("dashboard.apiKeyStats");
  if (!active || !payload || payload.length === 0) return null;
  const requests = payload.find((p) => p.dataKey === "requests")?.value ?? 0;
  const errors = payload.find((p) => p.dataKey === "errors")?.value ?? 0;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="mb-1 font-semibold">{label}</div>
      <div className="flex items-center gap-1.5" style={{ color: "var(--chart-1)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--chart-1)" }} />
        {t("requests", { count: requests })}
      </div>
      <div className="flex items-center gap-1.5" style={{ color: "var(--destructive)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--destructive)" }} />
        {t("errors", { count: errors })}
      </div>
    </div>
  );
}

export function ApiKeyDailyChart({ labels, requests, errors }: { labels: string[]; requests: number[]; errors: number[] }) {
  const t = useTranslations("dashboard.apiKeyStats");
  const data: DailyPoint[] = labels.map((date, i) => ({ date: date.slice(5), requests: requests[i] ?? 0, errors: errors[i] ?? 0 }));

  if (requests.every((v) => v === 0) && errors.every((v) => v === 0)) {
    return <p className="px-2 py-12 text-center text-sm text-muted-foreground">{t("chartEmpty")}</p>;
  }

  const totalRequests = requests.reduce((sum, v) => sum + v, 0);
  const totalErrors = errors.reduce((sum, v) => sum + v, 0);

  return (
    <div
      style={{ height: 260 }}
      role="img"
      aria-label={t("chartSummary", { requests: totalRequests, errors: totalErrors })}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="apiKeyRequestsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={4} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
          <Tooltip content={<DailyTooltip />} />
          <Area type="monotone" dataKey="requests" stroke="var(--chart-1)" fill="url(#apiKeyRequestsFill)" strokeWidth={2} />
          <Area type="monotone" dataKey="errors" stroke="var(--destructive)" fill="transparent" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
