/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { gameFromParams } from "@/lib/game";
import { getTranslations } from "next-intl/server";
import { Users, Shield, Trophy, User, Gamepad2 } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { PERMISSIONS } from "@gc-stats/db";
import { hasAccess, listAdminGames, requireAdminAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { AdminGameSwitcher } from "@/components/admin/admin-game-switcher";
import { publicGames } from "@/lib/public-games";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { DashboardTournamentsWidget } from "@/components/admin/dashboard-tournaments-widget";
import { DashboardMatchesWidget } from "@/components/admin/dashboard-matches-widget";
import { DashboardModificationsWidget } from "@/components/admin/dashboard-modifications-widget";
import { getDashboardCounts } from "@/lib/admin-data";
import { getDashboardTournaments, getDashboardRecentMatches, getDashboardModifications, type DashboardTournamentTab } from "@/lib/admin-dashboard";

const PAGE_KEYS = ["tournamentTab", "tournamentPage", "teamPage", "playerPage", "matchPage"] as const;

function parsePage(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });
  return { title: t("title") };
}

export default async function AdminDashboardPage({ params, searchParams }: { params: Promise<{ locale: string; game: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const game = await gameFromParams(params);
  const access = await requireAdminAccess(locale as AppLocale, game);
  const adminGames = await listAdminGames(access.userId);
  if (!access.isGameAdmin) redirect({ href: adminGames[0] ? `/admin/${adminGames[0]}` : "/", locale });

  const showTournaments = hasAccess(access, PERMISSIONS.tournamentsView);
  const showTeams = hasAccess(access, PERMISSIONS.teamsView);
  const showPlayers = hasAccess(access, PERMISSIONS.playersView);
  const sp = await searchParams;
  const query: Record<string, string> = {};
  for (const key of PAGE_KEYS) {
    const value = sp[key];
    if (typeof value === "string") query[key] = value;
  }
  const tournamentTab: DashboardTournamentTab = query.tournamentTab === "upcoming" || query.tournamentTab === "inactive" ? query.tournamentTab : "live";
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });
  const [counts, tournaments, recentMatches, teamMods, playerMods] = await Promise.all([
    getDashboardCounts(game),
    showTournaments ? getDashboardTournaments(game, tournamentTab, parsePage(query.tournamentPage)) : null,
    showTournaments ? getDashboardRecentMatches(game, parsePage(query.matchPage)) : null,
    showTeams ? getDashboardModifications(game, "team", parsePage(query.teamPage)) : null,
    showPlayers ? getDashboardModifications(game, "player", parsePage(query.playerPage)) : null,
  ]);

  const cards = [
    { href: "/admin/tournaments", label: t("tournaments"), value: counts.tournaments, icon: Trophy, color: "amber" as const, visible: showTournaments },
    { href: "/admin/teams", label: t("teams"), value: counts.teams, icon: Shield, color: "violet" as const, visible: showTeams },
    { href: "/admin/players", label: t("players"), value: counts.players, icon: User, color: "sky" as const, visible: showPlayers },
    { href: "/admin/tournaments", label: t("matches"), value: counts.matches, icon: Gamepad2, color: "orange" as const, visible: showTournaments },
  ].filter((card) => card.visible);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <AdminGameSwitcher games={adminGames} publicGames={publicGames()} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Link
            key={`${card.label}-${i}`}
            href={card.href}
            className="block rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <AdminStatCard label={card.label} value={card.value} icon={card.icon} color={card.color} />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tournaments && <DashboardTournamentsWidget tab={tournamentTab} data={tournaments} query={query} />}
        {teamMods && <DashboardModificationsWidget type="team" data={teamMods} query={query} />}
        {playerMods && <DashboardModificationsWidget type="player" data={playerMods} query={query} />}
        {recentMatches && <DashboardMatchesWidget data={recentMatches} query={query} />}
      </div>
    </div>
  );
}
