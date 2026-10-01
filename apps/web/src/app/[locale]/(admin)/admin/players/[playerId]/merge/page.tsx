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
import { getMergeablePlayerMapStats, getMergeablePlayerNews } from "@/lib/admin-player-merge";
import { getPersonOrganizations } from "@/lib/person-organizations-data";
import { getPersonProductionsPage } from "@/lib/production-credits-data";
import { getEntityLogos } from "@/lib/admin-logos";
import { parseEntityId } from "@/lib/entity-id";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { PlayerMergeForm } from "@/components/admin/player-merge-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; playerId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.players.merge" });
  return { title: t("title") };
}

export default async function AdminPlayerMergePage({
  params,
}: {
  params: Promise<{ locale: string; playerId: string }>;
}) {
  const { locale, playerId } = await params;
  const id = parseEntityId(playerId);
  if (id === null) notFound();

  await requireAdminPermission(locale as AppLocale, PERMISSIONS.playersMerge);
  const t = await getTranslations({ locale, namespace: "admin.players.merge" });

  const [player, teamHistory, organizations, production, newsItems, logoItems, matchStatItems] = await Promise.all([
    getAdminPlayer(id),
    getAdminPlayerTeamHistory(id),
    getPersonOrganizations(id),
    getPersonProductionsPage(id, { page: 1, sort: "date", direction: "desc", pageSize: 1000 }),
    getMergeablePlayerNews(id),
    getEntityLogos("person", id),
    getMergeablePlayerMapStats(id),
  ]);
  if (!player) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/players/${player.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToPlayer")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
      </div>

      <PlayerMergeForm
        playerId={player.id}
        playerHandle={player.handle}
        playerPronouns={player.pronouns}
        hasLinkedAccount={player.linkedUser !== null}
        teamHistoryItems={teamHistory}
        organizationItems={[...organizations.current, ...organizations.formers]}
        productionItems={production.items}
        newsItems={newsItems}
        logoItems={logoItems}
        matchStatItems={matchStatItems}
      />
    </div>
  );
}
