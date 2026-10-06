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
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import { getTournamentMapPool, buildTournamentMapInsights, getTournamentMapComps } from "@/lib/tournament-maps-data";
import { parseMapsFilters, mapsFiltersHref, type MapsFilters } from "@/lib/maps-filters";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { TournamentMapPoolPanel } from "@/components/tournament/tournament-map-pool-panel";
import { TournamentMapCompsPanel } from "@/components/tournament/tournament-map-comps-panel";
import { MapsFiltersBar } from "@/components/filters/maps-filters-bar";
import { PageLoading } from "@/components/site/page-loading";
import type { Metadata } from "next";
import { tournamentPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  return tournamentPageMetadata(locale, tournamentId, "tournamentPage.tabMaps");
}

export default async function TournamentMapsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; tournamentSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tournamentId } = await params;
  const id = parseEntityId(tournamentId);
  if (id === null) notFound();

  const tournament = await getPublicTournamentHeader(id);
  if (!tournament) notFound();

  const basePath = `${tournament.id}/${slugify(tournament.name)}`;
  // Already scoped to one tournament, only the date filter applies here.
  const filters: MapsFilters = { ...parseMapsFilters(await searchParams), tournamentId: null };

  return (
    <div>
      <TournamentHeader tournament={tournament} basePath={basePath} activeTab="maps" />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-7 pb-[70px]">
        <MapsFiltersBar basePath={`/tournaments/${basePath}/maps`} filters={filters} />
        {/* Keyed so the loader shows again on every filter change. */}
        <Suspense key={mapsFiltersHref("", filters)} fallback={<PageLoading />}>
          <TournamentMapsContent tournamentId={tournament.id} filters={filters} />
        </Suspense>
      </div>
    </div>
  );
}

async function TournamentMapsContent({ tournamentId, filters }: { tournamentId: number; filters: MapsFilters }) {
  const [mapPool, comps, t, tFilters] = await Promise.all([
    getTournamentMapPool(tournamentId, filters),
    getTournamentMapComps(tournamentId, filters),
    getTranslations("tournamentPage"),
    getTranslations("mapsFilters"),
  ]);
  const insights = buildTournamentMapInsights(mapPool);
  const filtered = !!filters.dateFrom || !!filters.dateTo;

  return (
    <>
      <TournamentMapPoolPanel insights={insights} overallPickRates={comps.overallPickRates} />
      {mapPool.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500" style={{ background: "var(--gcs-surface-2)" }}>
          {filtered ? tFilters("empty") : t("mapsPoolEmpty")}
        </div>
      ) : (
        <TournamentMapCompsPanel mapPool={mapPool} compsByMap={comps.compsByMap} pickRatesByMap={comps.pickRatesByMap} />
      )}
    </>
  );
}
