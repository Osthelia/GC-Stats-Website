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
import { getAdminPlayer, getAdminPlayerTeamHistory } from "@/lib/admin-players";
import { getEntityLogos } from "@/lib/admin-logos";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { PlayerEditForm } from "@/components/admin/player-edit-form";
import { PlayerTeamHistoryPanel } from "@/components/admin/player-team-history-panel";
import { EntityLogoPanel } from "@/components/admin/entity-logo-panel";
import { PlayerLinkedAccountCard } from "@/components/admin/player-linked-account-card";
import { PlayerDeleteButton } from "@/components/admin/player-delete-button";
import { GhostBadge } from "@/components/admin/ghost-badge";
import { GhostPromoteButton } from "@/components/admin/ghost-promote-button";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; playerId: string }> }): Promise<Metadata> {
  const { locale, playerId } = await params;
  const id = parseEntityId(playerId);
  const player = id === null ? null : await getAdminPlayer(id);
  if (player) return { title: player.handle };
  const t = await getTranslations({ locale, namespace: "admin.players" });
  return { title: t("title") };
}

export default async function AdminPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; playerId: string }>;
}) {
  const { locale, playerId } = await params;
  const id = parseEntityId(playerId);
  if (id === null) notFound();

  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.playersView);
  const t = await getTranslations({ locale, namespace: "admin.players.edit" });
  const [player, history, logos] = await Promise.all([
    getAdminPlayer(id),
    getAdminPlayerTeamHistory(id),
    getEntityLogos("person", id),
  ]);
  if (!player) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/players" className="text-sm text-muted-foreground hover:text-foreground">
            {t("backToList")}
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            {player.handle}
            {player.isGhost && <GhostBadge />}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/player/${player.id}/${slugify(player.handle)}`} />}>
            {t("viewPublic")}
          </Button>
          {player.isGhost && hasAccess(access, PERMISSIONS.playersEdit) && <GhostPromoteButton kind="player" id={player.id} name={player.handle} />}
          {hasAccess(access, PERMISSIONS.playersMerge) && (
            <Button variant="outline" size="sm" render={<Link href={`/admin/players/${player.id}/merge`} />}>
              {t("mergeButton")}
            </Button>
          )}
          {hasAccess(access, PERMISSIONS.playersDelete) && <PlayerDeleteButton playerId={player.id} playerHandle={player.handle} />}
        </div>
      </div>

      <PlayerEditForm
        player={player}
        canEdit={hasAccess(access, PERMISSIONS.playersEdit)}
        rightExtra={
          <>
            <EntityLogoPanel
              namespace="admin.players.edit"
              entityType="person"
              entityId={player.id}
              displayName={player.handle}
              entries={logos}
              canEdit={hasAccess(access, PERMISSIONS.playersEdit)}
            />
            <PlayerLinkedAccountCard playerId={player.id} linkedUser={player.linkedUser} />
          </>
        }
      />

      <PlayerTeamHistoryPanel playerId={player.id} initialEntries={history} canEdit={hasAccess(access, PERMISSIONS.playersEdit)} />
    </div>
  );
}
