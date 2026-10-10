/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS } from "@gc-stats/db";
import { getAdminTournament, listPointTypeOptions } from "@/lib/admin-tournaments";
import { listTournamentEntrants, listTournamentStages } from "@/lib/admin-tournament-detail";
import { getEntityLogos } from "@/lib/admin-logos";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { TournamentDetailHeader } from "@/components/admin/tournament-detail-header";
import { TournamentEntrantsPanel } from "@/components/admin/tournament-entrants-panel";
import { TournamentStagesOverview } from "@/components/admin/tournament-stages-overview";
import { EntityLogoPanel } from "@/components/admin/entity-logo-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { tournamentId } = await params;
  const id = Number(tournamentId);
  const tournament = Number.isInteger(id) ? await getAdminTournament(id) : null;
  return { title: tournament?.name ?? "Tournament" };
}

export default async function AdminTournamentDetailPage({ params }: { params: Promise<{ locale: string; tournamentId: string }> }) {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  if (!Number.isInteger(id)) notFound();

  const [access, tournament, entrants, stages, pointTypeOptions, logos] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView),
    getAdminTournament(id),
    listTournamentEntrants(id),
    listTournamentStages(id),
    listPointTypeOptions(),
    getEntityLogos("tournament", id),
  ]);
  if (!tournament) notFound();
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);

  return (
    <div className="flex flex-col gap-6">
      <TournamentDetailHeader tournament={tournament} pointTypeOptions={pointTypeOptions} canManage={canManage} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          <TournamentStagesOverview tournamentId={id} stages={stages} />
          <EntityLogoPanel namespace="admin.tournaments.logo" entityType="tournament" entityId={id} displayName={tournament.name} entries={logos} canEdit={canManage} />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <TournamentEntrantsPanel tournamentId={id} entrants={entrants} pointTypeOptions={pointTypeOptions} canManage={canManage} />
        </div>
      </div>
    </div>
  );
}
