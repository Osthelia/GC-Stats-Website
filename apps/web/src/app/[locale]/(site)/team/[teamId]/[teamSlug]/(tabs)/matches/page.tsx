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
import { getTeamPageInfo } from "@/lib/team-page-data";
import { getEntityMatchesPage, getEntityMatchesFilterOptions, parseEntityMatchesFilters, entityMatchesHref, entityMatchesStatusHrefs, ENTITY_MATCHES_PAGE_SIZE } from "@/lib/entity-matches";
import { MatchesList } from "@/components/matches/matches-list";
import { MatchFiltersBar } from "@/components/matches/match-filters-bar";
import { ListPagination } from "@/components/filters/list-pagination";
import type { Metadata } from "next";
import { teamPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; teamId: string }> }): Promise<Metadata> {
  const { locale, teamId } = await params;
  return teamPageMetadata(locale, teamId, "tabMatches");
}

export default async function TeamMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; teamSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teamId } = await params;
  const id = parseEntityId(teamId);
  if (id === null) notFound();

  const sp = await searchParams;
  const filters = parseEntityMatchesFilters(sp);
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageParam) || 1);

  const [team, { items: matches, counts, total }, filterOptions, t] = await Promise.all([
    getTeamPageInfo(id),
    getEntityMatchesPage({ kind: "team", id }, { filters, page }),
    getEntityMatchesFilterOptions({ kind: "team", id }),
    getTranslations("teamPage"),
  ]);
  if (!team) notFound();
  const basePath = `${team.id}/${slugify(team.name)}`;

  const totalPages = Math.max(1, Math.ceil(total / ENTITY_MATCHES_PAGE_SIZE));

  const matchesPath = `/team/${basePath}/matches`;

  return (
    <div>
      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <MatchFiltersBar
          basePath={matchesPath}
          filters={filters}
          options={filterOptions}
          labels={{
            tournamentLabel: t("matchesFilterTournamentLabel"),
            tournamentDefault: t("matchesFilterTournamentDefault"),
            opponentLabel: t("matchesFilterOpponentLabel"),
            opponentDefault: t("matchesFilterOpponentDefault"),
            resultLabel: t("matchesFilterResultLabel"),
            resultDefault: t("matchesFilterResultDefault"),
            resultWin: t("matchesFilterResultWin"),
            resultLoss: t("matchesFilterResultLoss"),
            resultDraw: t("matchesFilterResultDraw"),
          }}
        />

        <MatchesList
          matches={matches}
          emptyLabel={t("noMatches")}
          activeStatus={filters.status ?? "all"}
          statusCounts={counts}
          statusHrefs={entityMatchesStatusHrefs(matchesPath, filters)}
        />

        <ListPagination
          page={page}
          totalPages={totalPages}
          prevHref={entityMatchesHref(matchesPath, filters, page - 1)}
          nextHref={entityMatchesHref(matchesPath, filters, page + 1)}
          previousLabel={t("previous")}
          nextLabel={t("next")}
          pageOfLabel={t("pageOf", { page, total: totalPages })}
        />
      </div>
    </div>
  );
}
