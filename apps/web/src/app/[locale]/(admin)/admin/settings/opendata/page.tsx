/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Activity, AlertTriangle, ArrowLeft, Ban, CheckCircle2, Clock, Database, Download, Gauge, Hourglass, ShieldAlert, Users, Zap } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { FormattedDate } from "@/components/formatted-date";
import { OpenDataPressureChart, OpenDataRequestsChart } from "@/components/admin/opendata-monitoring-charts";
import { requireAdminPermission } from "@/lib/rbac";
import { getOpenDataConfig } from "@/lib/opendata/config";
import { MONITORING_RANGES, getOpenDataMonitoring, type MonitoringRange } from "@/lib/opendata/monitoring";
import { MAX_CONCURRENT, type PressureLevel } from "@/lib/opendata/pressure";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const LEVEL_BADGE: Record<PressureLevel, string> = {
  normal: "bg-emerald-400/10 text-emerald-400",
  elevated: "bg-amber-400/10 text-amber-400",
  critical: "bg-destructive/10 text-destructive",
};

const VERDICT_STYLE = {
  healthy: { className: "border-emerald-400/30 bg-emerald-400/5", icon: CheckCircle2, iconClass: "text-emerald-400" },
  strained: { className: "border-amber-400/30 bg-amber-400/5", icon: AlertTriangle, iconClass: "text-amber-400" },
  overloaded: { className: "border-destructive/40 bg-destructive/5", icon: ShieldAlert, iconClass: "text-destructive" },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.opendataMonitoring" });
  return { title: t("title") };
}

export default async function AdminOpenDataMonitoringPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ range?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  await requireAdminPermission(locale as AppLocale, PERMISSIONS.settingsView);
  const t = await getTranslations({ locale, namespace: "admin.opendataMonitoring" });

  const range: MonitoringRange = (MONITORING_RANGES as readonly string[]).includes(sp.range ?? "") ? (sp.range as MonitoringRange) : "24h";
  const [data, config] = await Promise.all([getOpenDataMonitoring(range), getOpenDataConfig()]);
  const { summary, verdict } = data;
  const verdictStyle = VERDICT_STYLE[verdict.level];
  const VerdictIcon = verdictStyle.icon;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const elevatedShare = data.samplesTotal > 0 ? (data.samplesElevated + data.samplesCritical) / data.samplesTotal : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/admin/settings" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground active:opacity-70">
            <ArrowLeft className="size-3.5" />
            {t("backToSettings")}
          </Link>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex rounded-lg border p-0.5" aria-label={t("rangeLabel")}>
            {MONITORING_RANGES.map((r) => (
              <Link
                key={r}
                href={{ pathname: "/admin/settings/opendata", query: { range: r } }}
                aria-current={r === range ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors active:scale-95",
                  r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t(`range.${r}`)}
              </Link>
            ))}
          </nav>
          <AdminRefreshButton label={t("refresh")} />
        </div>
      </div>

      <div className={cn("flex items-start gap-3 rounded-xl border p-4", verdictStyle.className)}>
        <VerdictIcon className={cn("mt-0.5 size-5 shrink-0", verdictStyle.iconClass)} />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{t(`verdict.${verdict.level}`)}</p>
          <p className="text-sm text-muted-foreground">{t(`verdictHint.${verdict.level}`)}</p>
          {verdict.reasons.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-sm">
              {verdict.reasons.map((reason) => (
                <li key={reason}>{t(`reasons.${reason}`, { shed: summary.shed, share: percent(elevatedShare), p95: summary.p95Ms })}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {t("configState", {
              enabled: config.enabled ? t("on") : t("off"),
              requireAccount: config.requireAccount ? t("on") : t("off"),
              browse: config.browsePerMinute,
              exports: config.exportsPerHour,
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <AdminStatCard label={t("stats.requests")} value={summary.requests.toLocaleString(locale)} icon={Activity} color="sky" />
        <AdminStatCard label={t("stats.clients")} value={summary.clients.toLocaleString(locale)} icon={Users} color="violet" />
        <AdminStatCard label={t("stats.exports")} value={summary.exports.toLocaleString(locale)} icon={Download} color="muted" />
        <AdminStatCard label={t("stats.cacheHitRate")} value={percent(summary.cacheHitRate)} icon={Zap} color="emerald" />
        <AdminStatCard label={t("stats.p95")} value={`${summary.p95Ms} ms`} icon={Clock} color={summary.p95Ms >= 3000 ? "orange" : "muted"} />
        <AdminStatCard label={t("stats.avgQueue")} value={`${summary.avgQueueMs} ms`} icon={Hourglass} color="muted" />
        <AdminStatCard label={t("stats.rateLimited")} value={summary.rateLimited.toLocaleString(locale)} icon={Ban} color={summary.rateLimited > 0 ? "amber" : "muted"} />
        <AdminStatCard label={t("stats.shed")} value={summary.shed.toLocaleString(locale)} icon={ShieldAlert} color={summary.shed > 0 ? "destructive" : "muted"} />
        <AdminStatCard label={t("stats.errors")} value={summary.errors.toLocaleString(locale)} icon={AlertTriangle} color={summary.errors > 0 ? "destructive" : "muted"} />
        <AdminStatCard label={t("stats.authRequired")} value={summary.authRequired.toLocaleString(locale)} icon={Users} color="muted" />
        <AdminStatCard label={t("stats.rowsServed")} value={summary.rowsServed.toLocaleString(locale)} icon={Database} color="muted" />
        <AdminStatCard label={t("stats.elevatedShare")} value={percent(elevatedShare)} icon={Gauge} color={elevatedShare > 0 ? "amber" : "muted"} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("requestsChart")}</CardTitle>
            <CardDescription>{t("requestsChartHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <OpenDataRequestsChart data={data.requestTimeline} range={range} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("pressureChart")}</CardTitle>
            <CardDescription>{t("pressureChartHint", { elevated: data.thresholds.elevatedLagMs, critical: data.thresholds.criticalLagMs })}</CardDescription>
          </CardHeader>
          <CardContent>
            <OpenDataPressureChart data={data.pressureTimeline} range={range} elevatedLagMs={data.thresholds.elevatedLagMs} criticalLagMs={data.thresholds.criticalLagMs} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("instances")}</CardTitle>
          <CardDescription>{t("instancesHint", { normal: MAX_CONCURRENT.normal, elevated: MAX_CONCURRENT.elevated })}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.instances.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("instancesEmpty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.instance")}</TableHead>
                  <TableHead>{t("columns.level")}</TableHead>
                  <TableHead className="text-right">{t("columns.lag")}</TableHead>
                  <TableHead className="text-right">{t("columns.poolWaiting")}</TableHead>
                  <TableHead className="text-right">{t("columns.inFlight")}</TableHead>
                  <TableHead className="text-right">{t("columns.queued")}</TableHead>
                  <TableHead>{t("columns.sampledAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.instances.map((i) => (
                  <TableRow key={i.instance}>
                    <TableCell className="font-mono text-xs">{i.instance}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", LEVEL_BADGE[i.level])}>{t(`level.${i.level}`)}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.lagMs} ms</TableCell>
                    <TableCell className="text-right tabular-nums">{i.poolWaiting}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.inFlight}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.queued}</TableCell>
                    <TableCell>
                      <FormattedDate date={i.sampledAt} mode="datetime" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("datasets")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.datasets.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("noRequests")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.dataset")}</TableHead>
                    <TableHead className="text-right">{t("columns.requests")}</TableHead>
                    <TableHead className="text-right">{t("columns.cacheHit")}</TableHead>
                    <TableHead className="text-right">{t("columns.avg")}</TableHead>
                    <TableHead className="text-right">{t("columns.p95")}</TableHead>
                    <TableHead className="text-right">{t("columns.rows")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.datasets.map((d) => (
                    <TableRow key={`${d.dataset}:${d.kind}`}>
                      <TableCell>
                        {d.dataset} <span className="text-xs text-muted-foreground">({t(`kind.${d.kind}`)})</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.served.toLocaleString(locale)} / {d.requests.toLocaleString(locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{percent(d.cacheHitRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.avgMs} ms</TableCell>
                      <TableCell className="text-right tabular-nums">{d.p95Ms} ms</TableCell>
                      <TableCell className="text-right tabular-nums">{d.rows.toLocaleString(locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("consumers")}</CardTitle>
            <CardDescription>{t("consumersHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.consumers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("noRequests")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.consumer")}</TableHead>
                    <TableHead className="text-right">{t("columns.requests")}</TableHead>
                    <TableHead className="text-right">{t("columns.exports")}</TableHead>
                    <TableHead className="text-right">{t("columns.rateLimited")}</TableHead>
                    <TableHead className="text-right">{t("columns.shed")}</TableHead>
                    <TableHead>{t("columns.lastSeen")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.consumers.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell>
                        {c.userId ? (
                          <Link href={`/admin/users/${c.userId}`} className="font-medium underline-offset-4 transition-colors hover:underline active:opacity-70">
                            {c.username ?? c.userId}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{t("anonymous", { hash: c.key.slice(0, 8) })}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.requests.toLocaleString(locale)}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.exports.toLocaleString(locale)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", c.rateLimited > 0 && "text-amber-400")}>{c.rateLimited.toLocaleString(locale)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", c.shed > 0 && "text-destructive")}>{c.shed.toLocaleString(locale)}</TableCell>
                      <TableCell>
                        <FormattedDate date={c.lastSeen} mode="datetime" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
