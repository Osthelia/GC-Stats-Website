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
import { getAdminMatch, getAdminMap, getEntrantRoster, getAdminMapPlayerStats } from "@/lib/admin-matches";
import { listTournamentEntrants } from "@/lib/admin-tournament-detail";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { MapArtBanner } from "@/components/admin/map-art-banner";
import { MapDetailForm } from "@/components/admin/map-detail-form";
import { MapPlayersPanel } from "@/components/admin/map-players-panel";
import { MapScoreboardForm } from "@/components/admin/map-scoreboard-form";
import { MapDangerZone } from "@/components/admin/map-danger-zone";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; matchId: string; mapId: string }> }): Promise<Metadata> {
  const { locale, matchId, mapId } = await params;
  const id = Number(matchId);
  const map = Number.isInteger(Number(mapId)) ? await getAdminMap(Number(mapId)) : null;
  const match = Number.isInteger(id) ? await getAdminMatch(id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.matches.maps" });
  return { title: match && map ? `${map.mapName ?? t("mapUnknown")} · ${match.containerName}` : t("heading") };
}

// Dedicated single-map admin page. The match overview only shows lightweight
// map preview cards linking here for full editing/Fetch/Renew/Merge.
export default async function AdminMapDetailPage({ params }: { params: Promise<{ locale: string; tournamentId: string; matchId: string; mapId: string }> }) {
  const { locale, tournamentId, matchId, mapId } = await params;
  const tournId = Number(tournamentId);
  const id = Number(matchId);
  const mId = Number(mapId);
  if (!Number.isInteger(tournId) || !Number.isInteger(id) || !Number.isInteger(mId)) notFound();

  const [access, t, match, map, entrants] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView),
    getTranslations("admin.tournaments.matches"),
    getAdminMatch(id),
    getAdminMap(mId),
    listTournamentEntrants(tournId),
  ]);
  if (!match || match.tournamentId !== tournId) notFound();
  if (!map || map.matchId !== id) notFound();
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);

  const entrantAName = entrants.find((e) => e.id === match.entrantAId)?.displayName ?? t("entrantNone");
  const entrantBName = entrants.find((e) => e.id === match.entrantBId)?.displayName ?? t("entrantNone");

  const bothEntrantsSet = match.entrantAId !== null && match.entrantBId !== null;
  const [rosterA, rosterB, playerStats] = bothEntrantsSet
    ? await Promise.all([getEntrantRoster(match.entrantAId!), getEntrantRoster(match.entrantBId!), getAdminMapPlayerStats(map.id)])
    : [[], [], []];

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/tournaments/${tournId}/matches/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        {t("backToMatch", { entrantA: entrantAName, entrantB: entrantBName })}
      </Link>

      <MapArtBanner
        entrantAName={entrantAName}
        entrantBName={entrantBName}
        mapName={map.mapName}
        score={{ a: map.teamAScore ?? 0, b: map.teamBScore ?? 0, entrantAId: match.entrantAId, entrantBId: match.entrantBId }}
      />

      <MapDetailForm
        map={map}
        canManage={canManage}
        riotPlayers={
          bothEntrantsSet && (
            <MapPlayersPanel entrantAId={match.entrantAId!} entrantBId={match.entrantBId!} entrantAName={entrantAName} entrantBName={entrantBName} stats={playerStats} />
          )
        }
      />

      {bothEntrantsSet && (
        <MapScoreboardForm
          mapId={map.id}
          entrantAId={match.entrantAId!}
          entrantBId={match.entrantBId!}
          entrantAName={entrantAName}
          entrantBName={entrantBName}
          rosterA={rosterA}
          rosterB={rosterB}
          initialStats={playerStats}
          canManage={canManage}
        />
      )}

      {canManage && <MapDangerZone mapId={map.id} tournamentId={tournId} matchId={id} />}
    </div>
  );
}
