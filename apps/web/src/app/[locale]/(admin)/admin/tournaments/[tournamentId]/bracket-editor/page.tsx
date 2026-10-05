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
import { listTournamentEntrants, listTournamentStages, listTournamentContainerOptions } from "@/lib/admin-tournament-detail";
import { listTournamentMatches } from "@/lib/admin-matches";
import { getAdminQualificationRules } from "@/lib/admin-bracket-qualifications";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { TournamentStagesPanel } from "@/components/admin/tournament-stages-panel";
import { TournamentMatchesPanel } from "@/components/admin/tournament-matches-panel";
import { QualificationRulesPanel } from "@/components/admin/qualification-rules-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  const tournament = Number.isInteger(id) ? await getAdminTournament(id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.bracketPage" });
  return { title: tournament ? `${t("title")} · ${tournament.name}` : t("title") };
}

export default async function AdminTournamentBracketPage({ params }: { params: Promise<{ locale: string; tournamentId: string }> }) {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  if (!Number.isInteger(id)) notFound();

  const [access, t, tournament, entrants, stages, matches, containerOptions, qualificationRules] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView),
    getTranslations({ locale, namespace: "admin.tournaments.bracketPage" }),
    getAdminTournament(id),
    listTournamentEntrants(id),
    listTournamentStages(id),
    listTournamentMatches(id),
    listTournamentContainerOptions(id),
    getAdminQualificationRules(id),
  ]);
  if (!tournament) notFound();
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);
  const groupContainers = containerOptions.filter((c) => c.containerType === "group");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/tournaments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToTournament")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{tournament.name}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <TournamentStagesPanel tournamentId={id} stages={stages} entrants={entrants} canManage={canManage} />
      <TournamentMatchesPanel tournamentId={id} matches={matches} />
      <QualificationRulesPanel tournamentId={id} rules={qualificationRules} groupContainers={groupContainers} matches={matches} canManage={canManage} />
    </div>
  );
}
