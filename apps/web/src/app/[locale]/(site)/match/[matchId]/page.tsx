/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
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
  getMatchStreams,
  getMatchVods,
  getMatchPlayerPovs,
  type MatchHeader as MatchHeaderData,
} from "@/lib/match-page-data";
import { parseEntityId } from "@/lib/entity-id";
import { getTranslations } from "next-intl/server";
import { MatchHeader } from "@/components/match/match-header";
import { MatchVetos } from "@/components/match/match-vetos";
import { MatchMaps } from "@/components/match/match-maps";
import { MatchEncounters } from "@/components/match/match-encounters";
import { MatchH2hGraph } from "@/components/match/match-h2h-graph";
import { MatchMedia } from "@/components/match/match-media";
import { findOrCreateThreadFor } from "@/lib/forum-threads";
import { ForumThreadPanel } from "@/components/forum/forum-thread-panel";

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

async function MatchSideEncounters({ matchId, match }: { matchId: number; match: MatchHeaderData }) {
  const encounters = await getMatchEncounters(matchId, match.a.teamId, match.b.teamId);
  return <MatchEncounters a={match.a} b={match.b} teamAWins={encounters.teamAWins} teamBWins={encounters.teamBWins} items={encounters.items} />;
}

async function MatchSideH2h({ match }: { match: MatchHeaderData }) {
  const t = await getTranslations("matchPage");
  const h2h = await getHeadToHeadMapComparison(match.a.teamId, match.b.teamId);
  return <MatchH2hGraph a={match.a} b={match.b} rows={h2h} title={t("mapGraph")} emptyLabel={t("noMapGraph")} winLabel={t("winRate")} />;
}

async function MatchExtras({ matchId, match, isCompleted }: { matchId: number; match: MatchHeaderData; isCompleted: boolean }) {
  const teamATag = match.a.shortName ?? match.a.displayName;
  const teamBTag = match.b.shortName ?? match.b.displayName;
  const [vetos, streams, vods, povs] = await Promise.all([
    getMatchVetos(matchId, match.a.entrantId),
    getMatchStreams(matchId),
    getMatchVods(matchId),
    getMatchPlayerPovs(matchId),
  ]);
  return (
    <>
      <MatchMedia streams={streams} vods={vods} povs={povs} isCompleted={isCompleted} />
      <MatchVetos steps={vetos} teamATag={teamATag} teamBTag={teamBTag} />
    </>
  );
}

async function MatchStatsSection({ matchId, match, teamAName, teamBName }: { matchId: number; match: MatchHeaderData; teamAName: string; teamBName: string }) {
  const [maps, { roundsByMapId, performanceByMapId, ecoByMapId, aggregatedPerformance, aggregatedEco }] =
    match.status === "completed"
      ? await getCompletedMatchStats(matchId, match.a.entrantId, match.b.entrantId)
      : await Promise.all([
          getMatchMaps(matchId, match.a.entrantId, match.b.entrantId),
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

async function MatchDiscussion({ matchId, page }: { matchId: number; page: number }) {
  const threadId = await findOrCreateThreadFor("match", matchId);
  return <ForumThreadPanel threadId={threadId} page={page} buildHref={(p) => `/match/${matchId}?discussionPage=${p}`} />;
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string; matchId: string }>; searchParams: Promise<{ discussionPage?: string }> }) {
  const { matchId: matchIdParam } = await params;
  const sp = await searchParams;
  const matchId = parseEntityId(matchIdParam);
  if (matchId == null) notFound();
  const discussionPage = Math.max(1, Number(sp.discussionPage) || 1);

  const match = await getMatchHeader(matchId);
  if (!match) notFound();

  const t = await getTranslations("matchPage");
  const isCompleted = match.status === "completed";
  const teamAName = match.a.entrantId != null ? match.a.displayName : isCompleted ? t("teamBye") : t("teamTbd");
  const teamBName = match.b.entrantId != null ? match.b.displayName : isCompleted ? t("teamBye") : t("teamTbd");

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 md:px-6">
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="order-2 w-full shrink-0 lg:order-1 lg:w-[360px]">
          <Suspense fallback={<SideCardSkeleton />}>
            <MatchSideEncounters matchId={matchId} match={match} />
          </Suspense>
        </div>

        <div className="order-1 w-full min-w-0 flex-1 lg:order-2">
          <MatchHeader match={match}>
            <Suspense fallback={<ExtrasSkeleton />}>
              <MatchExtras matchId={matchId} match={match} isCompleted={isCompleted} />
            </Suspense>
          </MatchHeader>
        </div>

        <div className="order-3 w-full shrink-0 lg:w-[360px]">
          <Suspense fallback={<SideCardSkeleton />}>
            <MatchSideH2h match={match} />
          </Suspense>
        </div>
      </div>

      <div className="mt-12">
        <Suspense fallback={<MapsSectionSkeleton />}>
          <MatchStatsSection matchId={matchId} match={match} teamAName={teamAName} teamBName={teamBName} />
        </Suspense>
      </div>

      <div className="mt-12">
        <h2 className="mb-4 text-lg font-bold text-neutral-100">{t("discussion")}</h2>
        <Suspense fallback={<ExtrasSkeleton />}>
          <MatchDiscussion matchId={matchId} page={discussionPage} />
        </Suspense>
      </div>
    </div>
  );
}
