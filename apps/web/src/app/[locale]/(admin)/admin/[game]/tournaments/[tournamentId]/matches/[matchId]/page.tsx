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
import { gameHasMaps, gameHasSeriesGames } from "@gc-stats/db/game";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminMatch, listLeagueMatchGames, listMatchMaps } from "@/lib/admin-matches";
import { listTournamentEntrants } from "@/lib/admin-tournament-detail";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { MatchVsBanner } from "@/components/admin/match-vs-banner";
import { MatchDeleteButton } from "@/components/admin/match-delete-button";
import { MatchMapsPanel } from "@/components/admin/match-maps-panel";
import { MatchGamesPanel, type MatchGameView } from "@/components/admin/match-games-panel";
import { getLeaguepediaLinkStatus, listLeaguepediaGameOptions } from "@/lib/admin-leaguepedia";
import type { LeagueGameEntrant } from "@/components/admin/league-game-dialog";
import { AdminPublicLinkButton } from "@/components/admin/admin-public-link-button";
import { matchStatusBadgeClass } from "@/lib/status-colors";
import { FormattedDate } from "@/components/formatted-date";
import { gameFromParams } from "@/lib/game";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; matchId: string; game: string }> }): Promise<Metadata> {
  const game = await gameFromParams(params);
  const { locale, matchId } = await params;
  const id = Number(matchId);
  const match = Number.isInteger(id) ? await getAdminMatch(game, id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.matches" });
  return { title: match ? match.containerName : t("editTitle") };
}

// Read-only overview (score, info table, maps preview) that links out to
// the dedicated edit/veto/maps pages, rather than being the edit form itself.
export default async function AdminMatchShowPage({ params }: { params: Promise<{ locale: string; tournamentId: string; matchId: string; game: string }> }) {
  const game = await gameFromParams(params);
  const { locale, tournamentId, matchId } = await params;
  const tournId = Number(tournamentId);
  const id = Number(matchId);
  if (!Number.isInteger(tournId) || !Number.isInteger(id)) notFound();

  // Maps are Valorant rows and LoL games are lol_games rows: each query only runs for the game that has it.
  const [access, t, match, entrants, mapRows, gameRows, leaguepediaGames, leaguepediaStatus] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView, game),
    getTranslations("admin.tournaments.matches"),
    getAdminMatch(game, id),
    listTournamentEntrants(game, tournId),
    gameHasMaps(game) ? listMatchMaps(id) : Promise.resolve([]),
    gameHasSeriesGames(game) ? listLeagueMatchGames(id) : Promise.resolve([]),
    gameHasSeriesGames(game) ? listLeaguepediaGameOptions(tournId) : Promise.resolve([]),
    gameHasSeriesGames(game) ? getLeaguepediaLinkStatus(tournId) : Promise.resolve(null),
  ]);
  if (!match || match.tournamentId !== tournId) notFound();
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);
  const leaguepediaLink = leaguepediaStatus && { linked: leaguepediaStatus.overviewPage !== null, fetchedAt: leaguepediaStatus.gamesFetchedAt?.toISOString() ?? null };

  const entrantAName = entrants.find((e) => e.id === match.entrantAId)?.displayName ?? t("entrantNone");
  const entrantBName = entrants.find((e) => e.id === match.entrantBId)?.displayName ?? t("entrantNone");
  const games: MatchGameView[] = gameRows.map((g) => ({ ...g, winnerName: entrants.find((e) => e.id === g.winnerEntrantId)?.displayName ?? null }));
  const matchEntrants: LeagueGameEntrant[] = [match.entrantAId, match.entrantBId]
    .filter((entrantId): entrantId is number => entrantId !== null)
    .map((entrantId) => ({ id: entrantId, name: entrants.find((e) => e.id === entrantId)?.displayName ?? t("entrantNone") }));


  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: t("fieldStatus"), value: <Badge className={matchStatusBadgeClass(match.status)}>{t(`status.${match.status}`)}</Badge> },
    { label: t("fieldScheduledAt"), value: match.scheduledAt ? <FormattedDate date={match.scheduledAt} mode="datetime" /> : "–" },
    { label: t("fieldBestOf"), value: `BO${match.bestOf}` },
    { label: t("fieldPatch"), value: match.patch ?? "–" },
    { label: t("infoContainer"), value: `${match.stageName} · ${match.containerName}` },
    { label: t("fieldLabel"), value: match.label ?? "–" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/admin/tournaments/${tournId}/bracket${match.stageId ? `?stage=${match.stageId}` : ""}`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToBracket")}
        </Link>
        <AdminPublicLinkButton href={`/match/${id}`} label={t("publicPageButton")} />
      </div>

      <MatchVsBanner
        entrantAName={entrantAName}
        entrantBName={entrantBName}
        score={{ a: match.scoreA ?? 0, b: match.scoreB ?? 0, entrantAId: match.entrantAId, entrantBId: match.entrantBId }}
      />

      {/* Info left, maps right (lg:col-span-7/5). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm tracking-wide text-muted-foreground uppercase">{t("infoHeading")}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" render={<Link href={`/admin/tournaments/${tournId}/matches/${id}/veto`} />}>
                  {t("vetoNavButton")}
                </Button>
                <Button variant="outline" render={<Link href={`/admin/tournaments/${tournId}/matches/${id}/edit`} />}>
                  {t("editButton")}
                </Button>
                {canManage && <MatchDeleteButton matchId={id} tournamentId={tournId} />}
              </div>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  {infoRows.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="w-40 py-2.5 pr-4 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{row.label}</td>
                      <td className="py-2.5 font-medium">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Preview cards only, linking to the dedicated .../maps/{mapId} page for full editing/Fetch/Renew/Merge. */}
        <div className="lg:col-span-5">
          {gameHasMaps(game) && <MatchMapsPanel tournamentId={tournId} matchId={id} maps={mapRows} canManage={canManage} />}
          {gameHasSeriesGames(game) && leaguepediaLink && (
            <MatchGamesPanel tournamentId={tournId} matchId={id} games={games} entrants={matchEntrants} leaguepediaGames={leaguepediaGames} leaguepediaLink={leaguepediaLink} canManage={canManage} />
          )}
        </div>
      </div>
    </div>
  );
}
