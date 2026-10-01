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
import { getAdminTeam, getAdminTeamRoster, getAdminTeamNameHistory } from "@/lib/admin-teams";
import { getEntityLogos } from "@/lib/admin-logos";
import { parseEntityId } from "@/lib/entity-id";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { TeamEditForm } from "@/components/admin/team-edit-form";
import { TeamRosterPanel } from "@/components/admin/team-roster-panel";
import { TeamNameHistoryPanel } from "@/components/admin/team-name-history-panel";
import { EntityLogoPanel } from "@/components/admin/entity-logo-panel";
import { TeamDeleteButton } from "@/components/admin/team-delete-button";
import { GhostBadge } from "@/components/admin/ghost-badge";
import { GhostPromoteButton } from "@/components/admin/ghost-promote-button";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; teamId: string }> }): Promise<Metadata> {
  const { locale, teamId } = await params;
  const id = parseEntityId(teamId);
  const team = id === null ? null : await getAdminTeam(id);
  if (team) return { title: team.name };
  const t = await getTranslations({ locale, namespace: "admin.teams" });
  return { title: t("title") };
}

export default async function AdminTeamPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  const id = parseEntityId(teamId);
  if (id === null) notFound();

  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.teamsView);
  const t = await getTranslations({ locale, namespace: "admin.teams.edit" });
  const [team, roster, nameHistory, logos] = await Promise.all([
    getAdminTeam(id),
    getAdminTeamRoster(id),
    getAdminTeamNameHistory(id),
    getEntityLogos("team", id),
  ]);
  if (!team) notFound();

  const canEdit = hasAccess(access, PERMISSIONS.teamsEdit);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/teams" className="text-sm text-muted-foreground hover:text-foreground">
            {t("backToList")}
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            {team.name}
            {team.isGhost && <GhostBadge />}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {team.isGhost && canEdit && <GhostPromoteButton kind="team" id={team.id} name={team.name} />}
          {hasAccess(access, PERMISSIONS.teamsMerge) && (
            <Button variant="outline" size="sm" render={<Link href={`/admin/teams/${team.id}/merge`} />}>
              {t("mergeButton")}
            </Button>
          )}
          {hasAccess(access, PERMISSIONS.teamsDelete) && <TeamDeleteButton teamId={team.id} teamName={team.name} />}
        </div>
      </div>

      {/* disabled on a fieldset cascades to every input/button/select inside it,
          so a view-only admin (teamsView without teamsEdit) gets a fully inert
          form instead of a throw on Save. */}
      <fieldset disabled={!canEdit} className="contents">
        <TeamEditForm
          team={team}
          rightExtra={
            <>
              <EntityLogoPanel
                namespace="admin.teams.edit"
                entityType="team"
                entityId={team.id}
                displayName={team.name}
                entries={logos}
                canEdit={canEdit}
              />
              <TeamNameHistoryPanel teamId={team.id} initialEntries={nameHistory} />
            </>
          }
        />

        <TeamRosterPanel teamId={team.id} initialMembers={roster} />
      </fieldset>
    </div>
  );
}
