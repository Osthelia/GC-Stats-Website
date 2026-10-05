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
import { getAdminMatch } from "@/lib/admin-matches";
import { listTournamentEntrants } from "@/lib/admin-tournament-detail";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { MatchVsBanner } from "@/components/admin/match-vs-banner";
import { MatchForm } from "@/components/admin/match-details-panel";
import { MatchWikicodeImport } from "@/components/admin/match-wikicode-import";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; matchId: string }> }): Promise<Metadata> {
  const { locale, matchId } = await params;
  const id = Number(matchId);
  const match = Number.isInteger(id) ? await getAdminMatch(id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.matches" });
  return { title: match ? `${t("editTitle")} · ${match.containerName}` : t("editTitle") };
}

// The fields form + wikicode import, as its own route separate from the
// read-only overview (show) page.
export default async function AdminMatchEditPage({ params }: { params: Promise<{ locale: string; tournamentId: string; matchId: string }> }) {
  const { locale, tournamentId, matchId } = await params;
  const tournId = Number(tournamentId);
  const id = Number(matchId);
  if (!Number.isInteger(tournId) || !Number.isInteger(id)) notFound();

  const [access, t, match, entrants] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView),
    getTranslations("admin.tournaments.matches"),
    getAdminMatch(id),
    listTournamentEntrants(tournId),
  ]);
  if (!match || match.tournamentId !== tournId) notFound();
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);

  const entrantAName = entrants.find((e) => e.id === match.entrantAId)?.displayName ?? t("entrantNone");
  const entrantBName = entrants.find((e) => e.id === match.entrantBId)?.displayName ?? t("entrantNone");

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/tournaments/${tournId}/matches/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        {t("backToMatch", { entrantA: entrantAName, entrantB: entrantBName })}
      </Link>

      <MatchVsBanner entrantAName={entrantAName} entrantBName={entrantBName} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MatchForm match={match} entrants={entrants} canManage={canManage} />
        </div>
        <MatchWikicodeImport matchId={id} canManage={canManage} />
      </div>
    </div>
  );
}
