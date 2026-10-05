/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import { MatchesPanel } from "@/components/home/matches-panel";
import { NewsPanel } from "@/components/home/news-panel";
import { TournamentsPanel } from "@/components/home/tournaments-panel";
import { getHomeMatchDays, getHomeNews, getHomeTournamentGroups } from "@/lib/home-data";
import { resolveNewsLanguages } from "@/lib/news-languages";
import { REGIONS } from "@/lib/tournament-regions";
import type { AppLocale } from "@/i18n/routing";

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

async function HomeMatches({ locale }: { locale: AppLocale }) {
  return <MatchesPanel initialPage={await getHomeMatchDays(locale)} />;
}

async function HomeTournaments({ locale }: { locale: AppLocale }) {
  return <TournamentsPanel groups={await getHomeTournamentGroups(REGIONS, locale)} />;
}

async function HomeNews({ locale }: { locale: AppLocale }) {
  const homeNews = await getHomeNews(locale, await resolveNewsLanguages(locale));
  return <NewsPanel featured={homeNews.featured} items={homeNews.items} />;
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;

  return (
    <div className="mx-auto max-w-[1550px] px-6 py-9 pb-[72px]">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Suspense fallback={<MatchesSkeleton />}>
          <HomeMatches locale={locale} />
        </Suspense>
        <aside className="flex min-w-0 flex-col gap-[38px]">
          <Suspense fallback={<BlockSkeleton className="h-72" />}>
            <HomeTournaments locale={locale} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton className="h-96" />}>
            <HomeNews locale={locale} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
