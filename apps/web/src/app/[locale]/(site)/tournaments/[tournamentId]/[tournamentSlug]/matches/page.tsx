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
import { getTournamentMatches, getTournamentMatchesStatusCounts, getTournamentMatchesFilterOptions, parseTournamentMatchesFilters, TOURNAMENT_MATCHES_PAGE_SIZE } from "@/lib/tournament-page-data";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { MatchesList } from "@/components/matches/matches-list";
import { TournamentMatchesFilterBar } from "@/components/tournament/tournament-matches-filter-bar";
import { ListPagination } from "@/components/filters/list-pagination";
import type { Metadata } from "next";
import { tournamentPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  return tournamentPageMetadata(locale, tournamentId, "tournamentPage.tabMatches");
}

export default async function TournamentMatchesPage({
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

  const sp = await searchParams;
  const filters = parseTournamentMatchesFilters(sp);
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageParam) || 1);

  const [matches, counts, filterOptions, t] = await Promise.all([
    getTournamentMatches(id, { filters, page }),
    getTournamentMatchesStatusCounts(id, filters),
    getTournamentMatchesFilterOptions(id),
    getTranslations("tournamentPage"),
  ]);

  const total = filters.status ? counts[filters.status] : counts.all;
  const totalPages = Math.max(1, Math.ceil(total / TOURNAMENT_MATCHES_PAGE_SIZE));

  const buildPageHref = (targetPage: number, status: string | null | undefined = filters.status) => {
    const qs = new URLSearchParams();
    if (filters.stageId != null) qs.set("stage", String(filters.stageId));
    if (filters.round) qs.set("round", filters.round);
    if (filters.teamId != null) qs.set("team", String(filters.teamId));
    if (filters.map) qs.set("map", filters.map);
    if (filters.sort) qs.set("sort", filters.sort);
    if (status) qs.set("status", status);
    if (targetPage !== 1) qs.set("page", String(targetPage));
    const s = qs.toString();
    return `/tournaments/${basePath}/matches${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <TournamentHeader tournament={tournament} basePath={basePath} activeTab="matches" />

      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <TournamentMatchesFilterBar
          basePath={basePath}
          filters={filters}
          options={filterOptions}
          labels={{
            stageLabel: t("matchesFilterStageLabel"),
            stageDefault: t("matchesFilterStageDefault"),
            roundLabel: t("matchesFilterRoundLabel"),
            roundDefault: t("matchesFilterRoundDefault"),
            teamLabel: t("matchesFilterTeamLabel"),
            teamDefault: t("matchesFilterTeamDefault"),
            teamSearch: t("matchesFilterTeamSearch"),
            teamNoResult: t("matchesFilterTeamNoResult"),
            mapLabel: t("matchesFilterMapLabel"),
            mapDefault: t("matchesFilterMapDefault"),
            sortLabel: t("matchesFilterSortLabel"),
            sortNewest: t("matchesSortNewest"),
            sortOldest: t("matchesSortOldest"),
          }}
        />

        <MatchesList
          matches={matches}
          emptyLabel={t("noMatches")}
          highlightWinner={false}
          activeStatus={filters.status ?? "all"}
          statusCounts={counts}
          statusHrefs={{
            all: buildPageHref(1, null),
            live: buildPageHref(1, "live"),
            upcoming: buildPageHref(1, "upcoming"),
            finished: buildPageHref(1, "finished"),
          }}
        />

        <ListPagination
          page={page}
          totalPages={totalPages}
          prevHref={buildPageHref(page - 1)}
          nextHref={buildPageHref(page + 1)}
          previousLabel={t("previous")}
          nextLabel={t("next")}
          pageOfLabel={t("pageOf", { page, total: totalPages })}
        />
      </div>
    </div>
  );
}
