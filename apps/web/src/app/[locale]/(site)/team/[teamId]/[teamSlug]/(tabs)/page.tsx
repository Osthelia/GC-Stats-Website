/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE GC-Stats License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getTeamPageInfo, getTeamRoster, getTeamRecentMatches, getTeamUpcomingMatches, getTeamPress } from "@/lib/team-page-data";
import { TeamRoster } from "@/components/team/team-roster";
import { RecentMatchesPanel } from "@/components/matches/recent-matches-panel";
import { PressPanel } from "@/components/press/press-panel";
import { TeamFormerMembers, FORMER_MEMBERS_PREVIEW } from "@/components/team/team-former-members";
import { entityMatchesHref } from "@/lib/entity-matches";
import type { AppLocale } from "@/i18n/routing";

// `/team/{id}/{slug}` — two separate path segments, like tournaments (see
// lib/entity-id.ts). `teamSlug` itself is never read back (cosmetic only,
// never validated), only re-derived from the real name so in-page links
// stay well-formed even from a stale shared URL.
export default async function TeamPage({ params }: { params: Promise<{ locale: string; teamId: string; teamSlug: string }> }) {
  const { locale, teamId } = await params;
  const id = parseEntityId(teamId);
  if (id === null) notFound();

  const [team, roster, upcoming, matches, press, t] = await Promise.all([
    getTeamPageInfo(id),
    getTeamRoster(id, { formers: { offset: 0, limit: FORMER_MEMBERS_PREVIEW } }),
    getTeamUpcomingMatches(id),
    getTeamRecentMatches(id),
    getTeamPress(id, locale as AppLocale),
    getTranslations("teamPage"),
  ]);
  if (!team) notFound();
  const basePath = `${team.id}/${slugify(team.name)}`;

  return (
    <div>
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-10 px-6 py-7 pb-[70px] lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-7">
          {upcoming.length > 0 && (
            <RecentMatchesPanel
              matches={upcoming}
              title={t("upcomingMatches")}
              seeAllHref={entityMatchesHref(`/team/${basePath}/matches`, { status: "upcoming" })}
              seeAllLabel={t("seeAll")}
              emptyLabel={t("noMatches")}
            />
          )}
          <RecentMatchesPanel
            matches={matches}
            title={t("recentMatches")}
            seeAllHref={`/team/${basePath}/matches`}
            seeAllLabel={t("seeAll")}
            emptyLabel={t("noMatches")}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-7">
          <TeamRoster members={roster.current} />
          <PressPanel items={press} title={t("press")} emptyLabel={t("noPress")} langNote={t("pressLangNote")} />
          <TeamFormerMembers members={roster.formers} segment={basePath} />
        </div>
      </div>
    </div>
  );
}
