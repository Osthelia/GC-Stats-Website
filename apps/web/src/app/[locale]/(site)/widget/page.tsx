/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@gc-stats/db/client";
import { teams, people, tournaments } from "@gc-stats/db";
import { visibleTeam, visiblePerson, visibleTournament } from "@/lib/ghost-visibility";
import { WidgetDirectory } from "@/components/widget/widget-directory";
import { getWidgetPreviewMatch } from "@/lib/widget-data";
import { buildHeadToHeadWidgetUrl, buildHeatmapWidgetUrl, parseHeadToHeadWidgetParams, parseHeatmapWidgetParams, type WidgetSearchParams } from "@/lib/widget-params";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as never, namespace: "widget" });
  return { title: t("title"), description: t("intro") };
}

async function teamName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const [row] = await db.select({ name: teams.name }).from(teams).where(and(eq(teams.id, id), visibleTeam));
  return row?.name ?? null;
}

async function playerName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const [row] = await db.select({ handle: people.handle }).from(people).where(and(eq(people.id, id), visiblePerson));
  return row?.handle ?? null;
}

async function tournamentName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const [row] = await db.select({ name: tournaments.name }).from(tournaments).where(and(eq(tournaments.id, id), visibleTournament));
  return row?.name ?? null;
}

export default async function WidgetDirectoryPage({ searchParams }: { searchParams: Promise<WidgetSearchParams> }) {
  const raw = await searchParams;
  const t = await getTranslations("widget");

  const h2h = parseHeadToHeadWidgetParams(raw);
  const heat = parseHeatmapWidgetParams(raw);

  const [teamAName, teamBName, h2hTournamentName, teamName_, playerName_, heatTournamentName, previewMatch] = await Promise.all([
    teamName(h2h.teamA),
    teamName(h2h.teamB),
    tournamentName(h2h.tournamentId),
    teamName(heat.teamId),
    playerName(heat.playerId),
    tournamentName(heat.tournamentId),
    getWidgetPreviewMatch(),
  ]);

  const h2hGeneratedUrl = buildHeadToHeadWidgetUrl(h2h);
  const heatGeneratedUrl = buildHeatmapWidgetUrl(heat);
  const h2hPreviewUrl = previewMatch ? buildHeadToHeadWidgetUrl({ teamA: previewMatch.teamAId, teamB: previewMatch.teamBId }) : null;

  const hasH2hQuery = h2h.teamA != null || h2h.teamB != null || h2h.tournamentId != null || h2h.startDate != null || h2h.endDate != null || h2h.patch != null || h2h.mapPool.length > 0;
  const hasHeatmapQuery = heat.map != null || heat.side != null || heat.teamId != null || heat.playerId != null || heat.agent != null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-12">
      <div className="border-b border-neutral-800 pb-6 text-center">
        <h1 className="text-4xl font-black tracking-tighter text-neutral-50 uppercase">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-500 italic">{t("intro")}</p>
      </div>

      <div className="mt-8">
        <WidgetDirectory
          headToHead={{
            previewUrl: h2hPreviewUrl,
            generatedUrl: hasH2hQuery ? h2hGeneratedUrl : null,
            autoOpen: hasH2hQuery,
            initial: { ...h2h, teamAName, teamBName, tournamentName: h2hTournamentName },
          }}
          heatmap={{
            previewUrl: "/widget/heatmap/preview",
            generatedUrl: hasHeatmapQuery ? heatGeneratedUrl : null,
            autoOpen: hasHeatmapQuery,
            initial: { ...heat, teamName: teamName_, playerName: playerName_, tournamentName: heatTournamentName },
          }}
        />
      </div>
    </div>
  );
}
