/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import {
  getTournamentProductionsPage,
  type TournamentProductionSort,
} from "@/lib/production-credits-data";
import { parseProductionParams } from "@/lib/production-list-params";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { ProductionSection } from "@/components/production/production-section";
import type { Metadata } from "next";
import { tournamentPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  return tournamentPageMetadata(locale, tournamentId, "tournamentPage.tabProduction");
}

const SORTS: readonly TournamentProductionSort[] = ["target", "date"];

export default async function TournamentProductionPage({
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
  const pagePath = `/tournaments/${basePath}/production`;

  const sp = await searchParams;
  const parsed = parseProductionParams(sp, SORTS, "date");

  const [page, t, tProduction] = await Promise.all([
    getTournamentProductionsPage(id, parsed),
    getTranslations("tournamentPage"),
    getTranslations("production"),
  ]);

  return (
    <div>
      <TournamentHeader
        tournament={tournament}
        basePath={basePath}
        activeTab="production"
      />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-7 pb-[70px]">
        <h1 className="text-lg font-black tracking-tight text-neutral-50">
          {t("productionTitle", { tournament: tournament.name })}
        </h1>

        <ProductionSection
          page={page}
          parsed={parsed}
          pagePath={pagePath}
          eventSortKey="target"
          eventColumnLabel={tProduction("colEvent")}
          showPerson
          showOrganization
          currentTournamentId={id}
        />
      </div>
    </div>
  );
}
