/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { gameHasSeriesGames } from "@gc-stats/db/game";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { getAdminMatch, getLeagueGameDraft } from "@/lib/admin-matches";
import { getChampionNamesForPatch } from "@/lib/data-dragon-client";
import { listTournamentEntrants } from "@/lib/admin-tournament-detail";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { MatchVsBanner } from "@/components/admin/match-vs-banner";
import { LeagueGameDraftEditor } from "@/components/admin/league-game-draft-editor";
import { gameFromParams } from "@/lib/game";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; matchId: string; game: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.matches.draft" });
  return { title: t("metaTitle") };
}

/** The draft of one game of a LoL series. Viewing needs tournamentsView, saving needs tournamentsManage. */
export default async function AdminLeagueGameDraftPage({ params }: { params: Promise<{ locale: string; tournamentId: string; matchId: string; gameId: string; game: string }> }) {
  const game = await gameFromParams(params);
  if (!gameHasSeriesGames(game)) notFound();
  const { locale, tournamentId, matchId, gameId } = await params;
  const tournId = Number(tournamentId);
  const id = Number(matchId);
  const gameNumber = Number(gameId);
  if (!Number.isInteger(tournId) || !Number.isInteger(id) || !Number.isInteger(gameNumber)) notFound();

  const [access, t, match, entrants] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView, game),
    getTranslations("admin.tournaments.matches"),
    getAdminMatch(game, id),
    listTournamentEntrants(game, tournId),
  ]);
  if (!match || match.tournamentId !== tournId) notFound();
  const champions = await getChampionNamesForPatch(match.patch);
  const draft = await getLeagueGameDraft(id, gameNumber, match);
  if (!draft) notFound();
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);
  const draftT = await getTranslations("admin.tournaments.matches.draft");

  const entrantName = (entrantId: number | null) => (entrantId === null ? t("entrantNone") : (entrants.find((e) => e.id === entrantId)?.displayName ?? t("entrantNone")));
  const seriesEntrants = [match.entrantAId, match.entrantBId].flatMap((entrantId) => (entrantId === null ? [] : [{ id: entrantId, name: entrantName(entrantId) }]));

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/tournaments/${tournId}/matches/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        {draftT("backToMatch")}
      </Link>

      <MatchVsBanner entrantAName={entrantName(match.entrantAId)} entrantBName={entrantName(match.entrantBId)} />

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{draftT("title", { order: draft.order })}</h1>
        <p>{draftT("description")}</p>
      </div>

      {draft.draftImportDiffers && (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {draftT("differsWarning")}
        </p>
      )}

      <LeagueGameDraftEditor tournamentId={tournId} matchId={id} entrants={seriesEntrants} draft={draft} champions={champions} canManage={canManage} />
    </div>
  );
}
