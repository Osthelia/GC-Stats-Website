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
import { getTournamentLiquipediaStages, getTournamentLiquipediaPeople, getTournamentLiquipediaBrackets } from "@/lib/admin-liquipedia";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { TournamentLiquipediaSections } from "@/components/admin/tournament-liquipedia-sections";
import { AdminPublicLinkButton } from "@/components/admin/admin-public-link-button";
import { slugify } from "@/lib/entity-id";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  const tournament = Number.isInteger(id) ? await getAdminTournament(id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.liquipedia" });
  return { title: tournament ? `${t("title")} · ${tournament.name}` : t("title") };
}

export default async function AdminTournamentLiquipediaPage({ params }: { params: Promise<{ locale: string; tournamentId: string }> }) {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  if (!Number.isInteger(id)) notFound();

  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView);
  const t = await getTranslations({ locale, namespace: "admin.tournaments.liquipedia" });

  const tournament = await getAdminTournament(id);
  if (!tournament) notFound();

  const [stages, people, brackets] = await Promise.all([getTournamentLiquipediaStages(id), getTournamentLiquipediaPeople(id), getTournamentLiquipediaBrackets(id)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <Link href={`/admin/tournaments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            {t("backToTournament")}
          </Link>
          <AdminPublicLinkButton href={`/tournaments/${id}/${slugify(tournament.name)}/liquipedia`} label={t("publicWikicodeButton")} />
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{tournament.name}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <TournamentLiquipediaSections tournamentId={id} stages={stages} people={people} brackets={brackets} canManage={hasAccess(access, PERMISSIONS.tournamentsManage)} />
    </div>
  );
}
