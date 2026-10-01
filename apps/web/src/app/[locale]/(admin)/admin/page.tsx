/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Users, Shield, Trophy, User, Gamepad2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { DashboardTournamentsWidget } from "@/components/admin/dashboard-tournaments-widget";
import { DashboardMatchesWidget } from "@/components/admin/dashboard-matches-widget";
import { DashboardModificationsWidget } from "@/components/admin/dashboard-modifications-widget";
import { getDashboardCounts } from "@/lib/admin-data";
import { getDashboardTournaments, getDashboardRecentMatches, getDashboardModifications } from "@/lib/admin-dashboard";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });
  return { title: t("title") };
}

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });
  const [counts, tournaments, recentMatches, teamMods, playerMods] = await Promise.all([
    getDashboardCounts(),
    getDashboardTournaments(),
    getDashboardRecentMatches(),
    getDashboardModifications("team"),
    getDashboardModifications("player"),
  ]);

  const cards = [
    { href: "/admin/tournaments", label: t("tournaments"), value: counts.tournaments, icon: Trophy, color: "amber" as const },
    { href: "/admin/teams", label: t("teams"), value: counts.teams, icon: Shield, color: "violet" as const },
    { href: "/admin/players", label: t("players"), value: counts.players, icon: User, color: "sky" as const },
    { href: "/admin/tournaments", label: t("matches"), value: counts.matches, icon: Gamepad2, color: "orange" as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
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
        <DashboardTournamentsWidget live={tournaments.live} upcoming={tournaments.upcoming} inactive={tournaments.inactive} />
        <DashboardModificationsWidget type="team" rows={teamMods} />
        <DashboardModificationsWidget type="player" rows={playerMods} />
        <DashboardMatchesWidget matches={recentMatches} />
      </div>
    </div>
  );
}
