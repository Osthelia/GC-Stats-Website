/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import { gameHasMaps, type GameSlug } from "@gc-stats/db/game";
import { notFound } from "next/navigation";
import {
  getMatchHeader,
  getMatchVetos,
  getMatchMaps,
  getMatchMapsStatsBatch,
  getCompletedMatchStats,
  aggregateMatchStats,
  getMatchEncounters,
  getHeadToHeadMapComparison,
  getMapPoolForPatch,
  getMatchStreams,
  getMatchVods,
  getMatchPlayerPovs,
  type MatchHeader as MatchHeaderData,
} from "@/lib/match-page-data";
import type { Metadata } from "next";
import { parseEntityId } from "@/lib/entity-id";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { withSection } from "@/lib/page-metadata";
import { MatchHeader } from "@/components/match/match-header";
import { MatchVetos } from "@/components/match/match-vetos";
import { MatchMaps } from "@/components/match/match-maps";
import { MatchEncounters } from "@/components/match/match-encounters";
import { MatchH2hGraph } from "@/components/match/match-h2h-graph";
import { MatchMedia } from "@/components/match/match-media";
import { findOrCreateThreadFor } from "@/lib/forum-threads";
import { ForumThreadPanel } from "@/components/forum/forum-thread-panel";
import { gameFromParams } from "@/lib/game";

function SideCardSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }} />;
}

function ExtrasSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <div className="h-10 w-full animate-pulse rounded-lg" style={{ background: "var(--gcs-surface-2)" }} />
      <div className="h-24 w-full animate-pulse rounded-lg" style={{ background: "var(--gcs-surface-2)" }} />
    </div>
  );
}

function MapsSectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 w-64 animate-pulse rounded-lg" style={{ background: "var(--gcs-surface-2)" }} />
      <div className="h-96 w-full animate-pulse rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }} />
    </div>
  );
}

async function MatchSideEncounters({ matchId, match, game }: { matchId: number; match: MatchHeaderData; game: GameSlug }) {
  const encounters = await getMatchEncounters(game, matchId, match.a.teamId, match.b.teamId);
  return <MatchEncounters a={match.a} b={match.b} teamAWins={encounters.teamAWins} teamBWins={encounters.teamBWins} items={encounters.items} />;
}

async function MatchSideH2h({ match, game }: { match: MatchHeaderData; game: GameSlug }) {
  const t = await getTranslations("matchPage");
  const mapPool = match.patch ? await getMapPoolForPatch(game, match.patch) : [];
  const h2h = await getHeadToHeadMapComparison(game, match.a.teamId, match.b.teamId, { mapPool });
  return <MatchH2hGraph a={match.a} b={match.b} rows={h2h} title={t("mapGraph")} emptyLabel={t("noMapGraph")} winLabel={t("winRate")} />;
}

async function MatchExtras({ matchId, match, isCompleted, game }: { matchId: number; match: MatchHeaderData; isCompleted: boolean; game: GameSlug }) {
  const teamATag = match.a.shortName ?? match.a.displayName;
  const teamBTag = match.b.shortName ?? match.b.displayName;
  const [vetos, streams, vods, povs] = await Promise.all([
    gameHasMaps(game) ? getMatchVetos(matchId, match.a.entrantId) : Promise.resolve([]),
    getMatchStreams(game, matchId),
    getMatchVods(game, matchId),
    getMatchPlayerPovs(game, matchId),
  ]);
  return (
    <>
      <MatchMedia streams={streams} vods={vods} povs={povs} isCompleted={isCompleted} game={game} />
      {gameHasMaps(game) && <MatchVetos steps={vetos} teamATag={teamATag} teamBTag={teamBTag} />}
    </>
  );
}

async function MatchStatsSection({ matchId, match, teamAName, teamBName, game }: { matchId: number; match: MatchHeaderData; teamAName: string; teamBName: string; game: GameSlug }) {
  const [maps, { roundsByMapId, performanceByMapId, ecoByMapId, aggregatedPerformance, aggregatedEco }] =
    match.status === "completed"
      ? await getCompletedMatchStats(game, matchId, match.a.entrantId, match.b.entrantId)
      : await Promise.all([
          getMatchMaps(game, matchId, match.a.entrantId, match.b.entrantId),
          getMatchMapsStatsBatch(matchId, match.a.entrantId, match.b.entrantId),
        ]);
  const aggregated = aggregateMatchStats(maps, match.a.entrantId, match.b.entrantId);

  return (
    <MatchMaps
      maps={maps}
      aggregated={aggregated}
      aggregatedPerformance={aggregatedPerformance}
      aggregatedEco={aggregatedEco}
      roundsByMapId={roundsByMapId}
      performanceByMapId={performanceByMapId}
      ecoByMapId={ecoByMapId}
      a={match.a}
      b={match.b}
      teamAName={teamAName}
      teamBName={teamBName}
      bestOf={match.bestOf}
    />
  );
}

async function MatchDiscussion({ game, matchId, page }: { game: GameSlug; matchId: number; page: number }) {
  const threadId = await findOrCreateThreadFor(game, "match", matchId);
  return <ForumThreadPanel threadId={threadId} page={page} game={game} buildHref={(p) => `/match/${matchId}?discussionPage=${p}`} />;
}

function sideNames(match: MatchHeaderData, t: Awaited<ReturnType<typeof getTranslations>>): [string, string] {
  const fallback = match.status === "completed" ? t("teamBye") : t("teamTbd");
  return [match.a.entrantId != null ? match.a.displayName : fallback, match.b.entrantId != null ? match.b.displayName : fallback];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; matchId: string; game: string }> }): Promise<Metadata> {
  const game = await gameFromParams(params);
  const { locale, matchId: matchIdParam } = await params;
  const matchId = parseEntityId(matchIdParam);
  const match = matchId == null ? null : await getMatchHeader(game, matchId);
  if (!match) return {};
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "matchPage" });
  const [teamAName, teamBName] = sideNames(match, t);
  return { title: withSection(`${teamAName} ${t("vs")} ${teamBName}`, match.tournamentName) };
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string; matchId: string; game: string }>; searchParams: Promise<{ discussionPage?: string }> }) {
  const game = await gameFromParams(params);
  const { matchId: matchIdParam } = await params;
  const sp = await searchParams;
  const matchId = parseEntityId(matchIdParam);
  if (matchId == null) notFound();
  const discussionPage = Math.max(1, Number(sp.discussionPage) || 1);

  const match = await getMatchHeader(game, matchId);
  if (!match) notFound();

  const t = await getTranslations("matchPage");
  const isCompleted = match.status === "completed";
  const [teamAName, teamBName] = sideNames(match, t);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 md:px-6">
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="order-2 w-full shrink-0 lg:order-1 lg:w-[360px]">
          <Suspense fallback={<SideCardSkeleton />}>
            <MatchSideEncounters game={game} matchId={matchId} match={match} />
          </Suspense>
        </div>

        <div className="order-1 w-full min-w-0 flex-1 lg:order-2">
          <MatchHeader game={game} match={match}>
            <Suspense fallback={<ExtrasSkeleton />}>
              <MatchExtras game={game} matchId={matchId} match={match} isCompleted={isCompleted} />
            </Suspense>
          </MatchHeader>
        </div>

        {gameHasMaps(game) && (
          <div className="order-3 w-full shrink-0 lg:w-[360px]">
            <Suspense fallback={<SideCardSkeleton />}>
              <MatchSideH2h game={game} match={match} />
            </Suspense>
          </div>
        )}
      </div>

      {gameHasMaps(game) && (
        <div className="mt-12">
          <Suspense fallback={<MapsSectionSkeleton />}>
            <MatchStatsSection game={game} matchId={matchId} match={match} teamAName={teamAName} teamBName={teamBName} />
          </Suspense>
        </div>
      )}

      <div className="mt-12">
        <h2 className="mb-4 text-lg font-bold text-neutral-100">{t("discussion")}</h2>
        <Suspense fallback={<ExtrasSkeleton />}>
          <MatchDiscussion game={game} matchId={matchId} page={discussionPage} />
        </Suspense>
      </div>
    </div>
  );
}
