/**
 * GC-Stats - opendata-monitoring-charts
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { useDisplayTimezone } from "@/lib/site-settings";
import type { PressureBucket, RequestBucket, MonitoringRange } from "@/lib/opendata/monitoring";

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };
const TOOLTIP_STYLE = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" };

function useBucketFormatter(range: MonitoringRange): (iso: string) => string {
  const locale = useLocale();
  const timeZone = useDisplayTimezone();
  const format = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", ...(range === "7d" ? { day: "2-digit", month: "2-digit" } : {}) });
  return (iso) => format.format(new Date(iso));
}

function EmptyChart({ label }: { label: string }) {
  return <p className="px-2 py-16 text-center text-sm text-muted-foreground">{label}</p>;
}

export function OpenDataRequestsChart({ data, range }: { data: RequestBucket[]; range: MonitoringRange }) {
  const t = useTranslations("admin.opendataMonitoring.charts");
  const formatBucket = useBucketFormatter(range);
  if (data.every((b) => b.served + b.rateLimited + b.shed + b.errors === 0)) return <EmptyChart label={t("empty")} />;
  const rows = data.map((b) => ({ ...b, label: formatBucket(b.at) }));

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="served" name={t("served")} stackId="r" fill="var(--chart-1)" />
          <Bar dataKey="rateLimited" name={t("rateLimited")} stackId="r" fill="var(--chart-4)" />
          <Bar dataKey="shed" name={t("shed")} stackId="r" fill="var(--chart-5)" />
          <Bar dataKey="errors" name={t("errors")} stackId="r" fill="var(--destructive)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OpenDataPressureChart({ data, range, elevatedLagMs, criticalLagMs }: { data: PressureBucket[]; range: MonitoringRange; elevatedLagMs: number; criticalLagMs: number }) {
  const t = useTranslations("admin.opendataMonitoring.charts");
  const formatBucket = useBucketFormatter(range);
  if (data.every((b) => b.lagMs === 0 && b.poolWaiting === 0 && b.inFlight === 0)) return <EmptyChart label={t("noSamples")} />;
  const rows = data.map((b) => ({ ...b, label: formatBucket(b.at) }));

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
          <YAxis yAxisId="lag" tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} unit="ms" />
          <YAxis yAxisId="count" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine yAxisId="lag" y={elevatedLagMs} stroke="var(--chart-4)" strokeDasharray="4 4" />
          <ReferenceLine yAxisId="lag" y={criticalLagMs} stroke="var(--destructive)" strokeDasharray="4 4" />
          <Line yAxisId="lag" type="monotone" dataKey="lagMs" name={t("lag")} stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line yAxisId="count" type="stepAfter" dataKey="poolWaiting" name={t("poolWaiting")} stroke="var(--destructive)" strokeWidth={2} dot={false} />
          <Line yAxisId="count" type="stepAfter" dataKey="inFlight" name={t("inFlight")} stroke="var(--chart-2)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
