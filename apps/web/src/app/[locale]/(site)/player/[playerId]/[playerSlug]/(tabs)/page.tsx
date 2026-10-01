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
import {
  getPlayerPageInfo,
  getPlayerTeamHistory,
  getPlayerRecentMatches,
  getPlayerPress,
} from "@/lib/player-page-data";
import { getPersonOrganizations } from "@/lib/person-organizations-data";
import { PlayerCurrentTeam } from "@/components/player/player-current-team";
import { PlayerFormerTeams } from "@/components/player/player-former-teams";
import { PlayerCurrentOrganizations } from "@/components/player/player-current-organizations";
import { RecentMatchesPanel } from "@/components/matches/recent-matches-panel";
import { PressPanel } from "@/components/press/press-panel";
import type { AppLocale } from "@/i18n/routing";

function BlockSkeleton({ className }: { className: string }) {
  return <div className={`w-full animate-pulse rounded-2xl border border-neutral-800 ${className}`} style={{ background: "var(--gcs-surface-3)" }} />;
}

async function OverviewMatches({ id, basePath }: { id: number; basePath: string }) {
  const [matches, t] = await Promise.all([getPlayerRecentMatches(id), getTranslations("playerPage")]);
  return (
    <RecentMatchesPanel
      matches={matches}
      title={t("recentMatches")}
      seeAllHref={`/player/${basePath}/matches`}
      seeAllLabel={t("seeAll")}
      emptyLabel={t("noMatches")}
    />
  );
}

async function OverviewCurrent({ id, pronouns }: { id: number; pronouns: number | null }) {
  const [teamHistory, organizations] = await Promise.all([getPlayerTeamHistory(id), getPersonOrganizations(id)]);
  return (
    <>
      <PlayerCurrentTeam teams={teamHistory.current} pronouns={pronouns} />
      <PlayerCurrentOrganizations organizations={organizations.current} pronouns={pronouns} hideWhenEmpty />
    </>
  );
}

async function OverviewPress({ id, locale }: { id: number; locale: AppLocale }) {
  const [press, t] = await Promise.all([getPlayerPress(id, locale), getTranslations("playerPage")]);
  return <PressPanel items={press} title={t("press")} emptyLabel={t("noPress")} langNote={t("pressLangNote")} />;
}

async function OverviewFormers({ id, pronouns, basePath }: { id: number; pronouns: number | null; basePath: string }) {
  const teamHistory = await getPlayerTeamHistory(id);
  return <PlayerFormerTeams teams={teamHistory.formers} pronouns={pronouns} segment={basePath} />;
}

// `/player/{id}/{slug}` — two separate path segments, like tournaments/team
// (see lib/entity-id.ts). `playerSlug` itself is never read back (cosmetic
// only, never validated), only re-derived from the real handle so in-page
// links stay well-formed even from a stale shared URL.
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ locale: string; playerId: string; playerSlug: string }>;
}) {
  const { locale, playerId } = await params;
  const id = parseEntityId(playerId);
  if (id === null) notFound();

  const player = await getPlayerPageInfo(id);
  if (!player) notFound();
  const basePath = `${player.id}/${slugify(player.handle)}`;

  return (
    <div>
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-10 px-6 py-7 pb-[70px] lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-7">
          <Suspense fallback={<BlockSkeleton className="h-96" />}>
            <OverviewMatches id={id} basePath={basePath} />
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col gap-7">
          <Suspense fallback={<BlockSkeleton className="h-40" />}>
            <OverviewCurrent id={id} pronouns={player.pronouns} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton className="h-64" />}>
            <OverviewPress id={id} locale={locale as AppLocale} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton className="h-40" />}>
            <OverviewFormers id={id} pronouns={player.pronouns} basePath={basePath} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
