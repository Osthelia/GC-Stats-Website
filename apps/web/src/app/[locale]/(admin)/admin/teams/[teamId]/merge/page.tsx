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
import { getAdminTeam, getAdminTeamRoster } from "@/lib/admin-teams";
import { getMergeableTeamTournaments, getMergeableTeamNews } from "@/lib/admin-team-merge";
import { getEntityLogos } from "@/lib/admin-logos";
import { parseEntityId } from "@/lib/entity-id";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { TeamMergeForm } from "@/components/admin/team-merge-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; teamId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.teams.merge" });
  return { title: t("title") };
}

export default async function AdminTeamMergePage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  const id = parseEntityId(teamId);
  if (id === null) notFound();

  await requireAdminPermission(locale as AppLocale, PERMISSIONS.teamsMerge);
  const t = await getTranslations({ locale, namespace: "admin.teams.merge" });

  const [team, roster, tournamentItems, newsItems, logoItems] = await Promise.all([
    getAdminTeam(id),
    getAdminTeamRoster(id),
    getMergeableTeamTournaments(id),
    getMergeableTeamNews(id),
    getEntityLogos("team", id),
  ]);
  if (!team) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/teams/${team.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToTeam")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
      </div>

      <TeamMergeForm teamId={team.id} teamName={team.name} rosterItems={roster} tournamentItems={tournamentItems} newsItems={newsItems} logoItems={logoItems} />
    </div>
  );
}
