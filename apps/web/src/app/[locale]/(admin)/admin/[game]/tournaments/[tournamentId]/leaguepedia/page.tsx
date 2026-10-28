/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { getAdminTournament } from "@/lib/admin-tournaments";
import { getLeaguepediaLinkStatus } from "@/lib/admin-leaguepedia";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { TournamentLeaguepediaPanel } from "@/components/admin/tournament-leaguepedia-panel";
import { gameFromParams } from "@/lib/game";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string; game: string }> }): Promise<Metadata> {
  const game = await gameFromParams(params);
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  const tournament = Number.isInteger(id) ? await getAdminTournament(game, id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.leaguepedia" });
  return { title: tournament ? `${t("title")} · ${tournament.name}` : t("title") };
}

export default async function AdminTournamentLeaguepediaPage({ params }: { params: Promise<{ locale: string; tournamentId: string; game: string }> }) {
  const game = await gameFromParams(params);
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  if (!Number.isInteger(id) || game !== "lol") notFound();

  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView, game);
  const t = await getTranslations({ locale, namespace: "admin.tournaments.leaguepedia" });
  const tBack = await getTranslations({ locale, namespace: "admin.tournaments.liquipedia" });

  const tournament = await getAdminTournament(game, id);
  if (!tournament) notFound();

  const link = await getLeaguepediaLinkStatus(id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/tournaments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          {tBack("backToTournament")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{tournament.name}</h1>
      </div>

      <div className="max-w-2xl">
        <TournamentLeaguepediaPanel
          tournamentId={id}
          status={{ ...link, gamesFetchedAt: link.gamesFetchedAt?.toISOString() ?? null }}
          canManage={hasAccess(access, PERMISSIONS.tournamentsManage)}
        />
      </div>
    </div>
  );
}
