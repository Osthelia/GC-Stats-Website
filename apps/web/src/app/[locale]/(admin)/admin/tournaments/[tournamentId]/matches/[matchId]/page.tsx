/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminMatch, listMatchMaps } from "@/lib/admin-matches";
import { listTournamentEntrants } from "@/lib/admin-tournament-detail";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { MatchVsBanner } from "@/components/admin/match-vs-banner";
import { MatchDeleteButton } from "@/components/admin/match-delete-button";
import { MatchMapsPanel } from "@/components/admin/match-maps-panel";
import { AdminPublicLinkButton } from "@/components/admin/admin-public-link-button";
import { matchStatusBadgeClass } from "@/lib/status-colors";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; matchId: string }> }): Promise<Metadata> {
  const { locale, matchId } = await params;
  const id = Number(matchId);
  const match = Number.isInteger(id) ? await getAdminMatch(id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.matches" });
  return { title: match ? match.containerName : t("editTitle") };
}

// Read-only overview (score, info table, maps preview) that links out to
// the dedicated edit/veto/maps pages, rather than being the edit form itself.
export default async function AdminMatchShowPage({ params }: { params: Promise<{ locale: string; tournamentId: string; matchId: string }> }) {
  const { locale, tournamentId, matchId } = await params;
  const tournId = Number(tournamentId);
  const id = Number(matchId);
  if (!Number.isInteger(tournId) || !Number.isInteger(id)) notFound();

  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView);
  const t = await getTranslations("admin.tournaments.matches");
  const uiLocale = await getLocale();

  const match = await getAdminMatch(id);
  if (!match || match.tournamentId !== tournId) notFound();

  const [entrants, mapRows] = await Promise.all([listTournamentEntrants(tournId), listMatchMaps(id)]);
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);

  const entrantAName = entrants.find((e) => e.id === match.entrantAId)?.displayName ?? t("entrantNone");
  const entrantBName = entrants.find((e) => e.id === match.entrantBId)?.displayName ?? t("entrantNone");

  const dateFormat = new Intl.DateTimeFormat(uiLocale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: t("fieldStatus"), value: <Badge className={matchStatusBadgeClass(match.status)}>{t(`status.${match.status}`)}</Badge> },
    { label: t("fieldScheduledAt"), value: match.scheduledAt ? dateFormat.format(new Date(match.scheduledAt)) : "–" },
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
          <MatchMapsPanel tournamentId={tournId} matchId={id} maps={mapRows} canManage={canManage} />
        </div>
      </div>
    </div>
  );
}
