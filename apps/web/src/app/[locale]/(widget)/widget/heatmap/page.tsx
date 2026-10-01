/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getHeatmapPositions } from "@/lib/widget-data";
import { parseHeatmapWidgetParams, type WidgetSearchParams } from "@/lib/widget-params";
import { VALORANT_MINIMAPS } from "@/lib/valorant-minimaps";
import { HeatmapCanvas } from "@/components/widget/heatmap-canvas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as never, namespace: "widget" });
  return { title: t("available.heatmap.name") };
}

function parseDateBound(date: string | null, endOfDay: boolean): Date | undefined {
  if (!date) return undefined;
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

export default async function HeatmapWidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<WidgetSearchParams>;
}) {
  const { locale } = await params;
  const raw = await searchParams;
  const p = parseHeatmapWidgetParams(raw);

  if (!p.map) return null;
  const calibration = VALORANT_MINIMAPS[p.map]!;
  const t = await getTranslations({ locale: locale as never, namespace: "widget" });

  const positions = await getHeatmapPositions({
    mapKey: p.map,
    tournamentId: p.tournamentId ?? undefined,
    start: parseDateBound(p.startDate, false),
    end: parseDateBound(p.endDate, true),
    side: p.side ?? undefined,
    teamId: p.teamId ?? undefined,
    playerId: p.playerId ?? undefined,
    eventTypes: p.eventTypes.length > 0 ? p.eventTypes : undefined,
    agent: p.agent ?? undefined,
    timeStart: p.timeStart ?? undefined,
    timeEnd: p.timeEnd ?? undefined,
    timeReference: p.timeReference,
  });

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="relative overflow-hidden" style={{ width: "min(100vw, 100vh)", height: "min(100vw, 100vh)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={calibration.image} alt={p.map} className="pointer-events-none absolute inset-0 h-full w-full object-contain select-none" />
        <HeatmapCanvas positions={positions} color={p.color} label={t("heatmapCanvasLabel", { map: p.map })} />
      </div>
    </div>
  );
}
