/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { getAdminTournament } from "@/lib/admin-tournaments";
import { listTournamentContainerOptions } from "@/lib/admin-tournament-detail";
import { listTournamentMatches } from "@/lib/admin-matches";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { TournamentOperationsPanel } from "@/components/admin/tournament-operations-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  const tournament = Number.isInteger(id) ? await getAdminTournament(id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.operations" });
  return { title: tournament ? `${t("title")} · ${tournament.name}` : t("title") };
}

export default async function AdminTournamentOperationsPage({ params }: { params: Promise<{ locale: string; tournamentId: string }> }) {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  if (!Number.isInteger(id)) notFound();

  const [, t, tournament, containers, matches] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsManage),
    getTranslations({ locale, namespace: "admin.tournaments.operations" }),
    getAdminTournament(id),
    listTournamentContainerOptions(id),
    listTournamentMatches(id),
  ]);
  if (!tournament) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/tournaments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToTournament")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{tournament.name}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <TournamentOperationsPanel tournamentId={id} containers={containers} matches={matches} />
    </div>
  );
}
