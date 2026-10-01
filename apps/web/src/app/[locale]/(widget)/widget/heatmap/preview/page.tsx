/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getHeatmapPreviewPositions } from "@/lib/widget-data";
import { VALORANT_MINIMAPS } from "@/lib/valorant-minimaps";
import { HeatmapCanvas } from "@/components/widget/heatmap-canvas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as never, namespace: "widget" });
  return { title: t("previewTitle") };
}

/**
 * Fabricated-data thumbnail for the widgets directory's heatmap card and
 * the builder's empty-state preview — never queries real position data
 * (see lib/widget-data.ts's getHeatmapPreviewPositions for why).
 */
export default async function HeatmapPreviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as never, namespace: "widget" });
  const positions = getHeatmapPreviewPositions();
  const calibration = VALORANT_MINIMAPS.ascent!;

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="relative overflow-hidden" style={{ width: "min(100vw, 100vh)", height: "min(100vw, 100vh)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={calibration.image} alt="Ascent" className="pointer-events-none absolute inset-0 h-full w-full object-contain select-none" />
        <HeatmapCanvas positions={positions} color={null} label={t("heatmapCanvasLabel", { map: "Ascent" })} />
      </div>
    </div>
  );
}
