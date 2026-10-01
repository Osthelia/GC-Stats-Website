/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { and, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@gc-stats/db/client";
import { teams } from "@gc-stats/db";
import { visibleTeam } from "@/lib/ghost-visibility";
import { getHeadToHeadMapComparison, getMapPoolForPatch, type MatchSide } from "@/lib/match-page-data";
import { parseHeadToHeadWidgetParams, type WidgetSearchParams } from "@/lib/widget-params";
import { getCurrentLogoUrls } from "@/lib/admin-logos";
import { MatchH2hGraph } from "@/components/match/match-h2h-graph";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as never, namespace: "widget" });
  return { title: t("available.headToHead.name") };
}

function parseDateBound(date: string | null, endOfDay: boolean): Date | undefined {
  if (!date) return undefined;
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

function toSide(team: { id: number; name: string; shortName: string | null; countryCode: string | null }, logos: Map<number, string | null>): MatchSide {
  // Broadcast overlay, always rendered the same way regardless of any
  // visitor's site theme preference — no light variant to pick here.
  const logoUrl = logos.get(team.id) ?? null;
  return { entrantId: null, teamId: team.id, isGhost: false, displayName: team.name, shortName: team.shortName, countryCode: team.countryCode, logoUrl, logoUrlLight: logoUrl };
}

export default async function HeadToHeadWidgetPage({ searchParams }: { searchParams: Promise<WidgetSearchParams> }) {
  const raw = await searchParams;
  const p = parseHeadToHeadWidgetParams(raw);
  const t = await getTranslations("matchPage");

  if (p.teamA == null || p.teamB == null || p.teamA === p.teamB) return null;

  const teamRows = await db
    .select({ id: teams.id, name: teams.name, shortName: teams.shortName, countryCode: teams.countryCode })
    .from(teams)
    .where(and(inArray(teams.id, [p.teamA, p.teamB]), visibleTeam));
  const teamA = teamRows.find((row) => row.id === p.teamA);
  const teamB = teamRows.find((row) => row.id === p.teamB);
  if (!teamA || !teamB) return null;

  const mapPool = p.mapPool.length > 0 ? p.mapPool : p.patch ? await getMapPoolForPatch(p.patch) : undefined;

  const [rows, logos] = await Promise.all([
    getHeadToHeadMapComparison(p.teamA, p.teamB, {
      tournamentId: p.tournamentId ?? undefined,
      start: parseDateBound(p.startDate, false),
      end: parseDateBound(p.endDate, true),
      mapPool: mapPool && mapPool.length > 0 ? mapPool : undefined,
    }),
    getCurrentLogoUrls("team", [p.teamA, p.teamB]),
  ]);

  const a = toSide(teamA, logos);
  const b = toSide(teamB, logos);

  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <MatchH2hGraph a={a} b={b} rows={rows} title={t("mapGraph")} emptyLabel={t("noMapGraph")} winLabel={t("winRate")} bare />
      </div>
    </div>
  );
}
