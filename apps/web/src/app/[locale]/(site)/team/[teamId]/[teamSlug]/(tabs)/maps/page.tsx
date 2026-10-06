/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getTeamPageInfo } from "@/lib/team-page-data";
import { getTeamMapPool, buildTeamMapInsights, getTeamMapComps } from "@/lib/team-maps-data";
import { getEntityMatchesFilterOptions } from "@/lib/entity-matches";
import { parseMapsFilters, mapsFiltersHref, type MapsFilters } from "@/lib/maps-filters";
import { TeamMapPoolPanel } from "@/components/team/team-map-pool-panel";
import { TeamMapCompsPanel } from "@/components/team/team-map-comps-panel";
import { MapsFiltersBar } from "@/components/filters/maps-filters-bar";
import { PageLoading } from "@/components/site/page-loading";
import type { Metadata } from "next";
import { teamPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; teamId: string }> }): Promise<Metadata> {
  const { locale, teamId } = await params;
  return teamPageMetadata(locale, teamId, "tabMaps");
}

export default async function TeamMapsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; teamSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teamId } = await params;
  const id = parseEntityId(teamId);
  if (id === null) notFound();

  const filters = parseMapsFilters(await searchParams);

  const [team, filterOptions] = await Promise.all([getTeamPageInfo(id), getEntityMatchesFilterOptions({ kind: "team", id })]);
  if (!team) notFound();
  const mapsPath = `/team/${team.id}/${slugify(team.name)}/maps`;

  return (
    <div>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-7 pb-[70px]">
        <MapsFiltersBar basePath={mapsPath} filters={filters} tournaments={filterOptions.tournaments} />
        {/* Keyed so the loader shows again on every filter change. */}
        <Suspense key={mapsFiltersHref("", filters)} fallback={<PageLoading />}>
          <TeamMapsContent teamId={team.id} filters={filters} />
        </Suspense>
      </div>
    </div>
  );
}

async function TeamMapsContent({ teamId, filters }: { teamId: number; filters: MapsFilters }) {
  const [mapPool, comps, t, tFilters] = await Promise.all([
    getTeamMapPool(teamId, filters),
    getTeamMapComps(teamId, filters),
    getTranslations("teamPage"),
    getTranslations("mapsFilters"),
  ]);
  const insights = buildTeamMapInsights(mapPool);
  const filtered = filters.tournamentId != null || !!filters.dateFrom || !!filters.dateTo;

  return (
    <>
      <TeamMapPoolPanel insights={insights} overallPickRates={comps.overallPickRates} />
      {mapPool.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500" style={{ background: "var(--gcs-surface-2)" }}>
          {filtered ? tFilters("empty") : t("mapsPoolEmpty")}
        </div>
      ) : (
        <TeamMapCompsPanel teamId={teamId} filters={filters} mapPool={mapPool} compsByMap={comps.compsByMap} pickRatesByMap={comps.pickRatesByMap} />
      )}
    </>
  );
}
