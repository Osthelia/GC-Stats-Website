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
import { getPlayerPageInfo } from "@/lib/player-page-data";
import { getPersonOrganizations } from "@/lib/person-organizations-data";
import {
  getPersonProductionsPage,
  type PersonProductionSort,
} from "@/lib/production-credits-data";
import { parseProductionParams } from "@/lib/production-list-params";
import { PlayerCurrentOrganizations } from "@/components/player/player-current-organizations";
import { PlayerFormerOrganizations } from "@/components/player/player-former-organizations";
import { ProductionSection } from "@/components/production/production-section";
import type { Metadata } from "next";
import { playerPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; playerId: string }> }): Promise<Metadata> {
  const { locale, playerId } = await params;
  return playerPageMetadata(locale, playerId, "tabProduction");
}

const SORTS: readonly PersonProductionSort[] = ["tournament", "date"];

/** "Production" tab: every production this person has been credited on (left), organization affiliations (right) — distinct from the "history" tab, which is only about team rosters. */
export default async function PlayerProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string; playerSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { playerId } = await params;
  const id = parseEntityId(playerId);
  if (id === null) notFound();

  const sp = await searchParams;
  const parsed = parseProductionParams(sp, SORTS, "date");

  const [player, page, organizations, t, tProduction] =
    await Promise.all([
      getPlayerPageInfo(id),
      getPersonProductionsPage(id, parsed),
      getPersonOrganizations(id),
      getTranslations("playerPage"),
      getTranslations("production"),
    ]);
  if (!player) notFound();
  const pagePath = `/player/${player.id}/${slugify(player.handle)}/production`;

  return (
    <div>
      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <h1 className="mb-6 text-lg font-black tracking-tight text-neutral-50">
          {t("productionTitle", { player: player.handle })}
        </h1>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <ProductionSection
              page={page}
              parsed={parsed}
              pagePath={pagePath}
              eventSortKey="tournament"
              eventColumnLabel={tProduction("colTournament")}
              showPerson={false}
              showOrganization
            />
          </div>

          <div className="flex min-w-0 flex-col gap-7">
            <PlayerCurrentOrganizations
              organizations={organizations.current}
              pronouns={player.pronouns}
            />
            <PlayerFormerOrganizations
              organizations={organizations.formers}
              pronouns={player.pronouns}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
