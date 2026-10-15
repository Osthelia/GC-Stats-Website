/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import type { GameSlug } from "@gc-stats/db/game";
import { MatchesPanel } from "@/components/home/matches-panel";
import { NewsPanel } from "@/components/home/news-panel";
import { TournamentsPanel } from "@/components/home/tournaments-panel";
import { getHomeMatchPage, getHomeNews, getHomeTournamentGroups } from "@/lib/home-data";
import { resolveNewsLanguages } from "@/lib/news-languages";
import { REGIONS } from "@/lib/tournament-regions";
import type { AppLocale } from "@/i18n/routing";
import { gameFromParams } from "@/lib/game";

function BlockSkeleton({ className }: { className: string }) {
  return <div className={`w-full animate-pulse rounded-2xl border border-neutral-800 ${className}`} style={{ background: "var(--gcs-surface-3)" }} />;
}

function MatchesSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-8 w-72 animate-pulse rounded-lg" style={{ background: "var(--gcs-surface-2)" }} />
      <BlockSkeleton className="h-64" />
      <BlockSkeleton className="h-96" />
    </div>
  );
}

async function HomeMatches({ game }: { game: GameSlug }) {
  return <MatchesPanel initialPage={await getHomeMatchPage(game)} />;
}

async function HomeTournaments({ locale, game }: { locale: AppLocale; game: GameSlug }) {
  return <TournamentsPanel groups={await getHomeTournamentGroups(game, REGIONS, locale)} />;
}

async function HomeNews({ locale, game }: { locale: AppLocale; game: GameSlug }) {
  const homeNews = await getHomeNews(game, locale, await resolveNewsLanguages(locale));
  return <NewsPanel featured={homeNews.featured} items={homeNews.items} />;
}

export default async function HomePage({ params }: { params: Promise<{ locale: string; game: string }> }) {
  const locale = (await params).locale as AppLocale;
  const game = await gameFromParams(params);

  return (
    <div className="mx-auto max-w-[1550px] px-6 py-9 pb-[72px]">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Suspense fallback={<MatchesSkeleton />}>
          <HomeMatches game={game} />
        </Suspense>
        <aside className="flex min-w-0 flex-col gap-[38px]">
          <Suspense fallback={<BlockSkeleton className="h-72" />}>
            <HomeTournaments game={game} locale={locale} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton className="h-96" />}>
            <HomeNews game={game} locale={locale} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
