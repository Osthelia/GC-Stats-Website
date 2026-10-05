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
import { getAdminTournament } from "@/lib/admin-tournaments";
import { getAdminTournamentStages } from "@/lib/tournament-bracket-data";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { BracketViewerPanel } from "@/components/admin/bracket-viewer/bracket-viewer-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  const tournament = Number.isInteger(id) ? await getAdminTournament(id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.bracketViewerPage" });
  return { title: tournament ? `${t("title")} · ${tournament.name}` : t("title") };
}

/**
 * Read-only, public-style rendering of the tournament's bracket — distinct
 * from `/bracket-editor` (stage/container CRUD + the drag-and-drop visual
 * editor entry points). Clicking a match here opens its admin overview
 * page directly, mirroring how the public site's bracket links to matches.
 */
export default async function AdminTournamentBracketViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; tournamentId: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { locale, tournamentId } = await params;
  const sp = await searchParams;
  const id = Number(tournamentId);
  if (!Number.isInteger(id)) notFound();

  const [, t, tOverview, tournament, stages] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView),
    getTranslations({ locale, namespace: "admin.tournaments.bracketViewerPage" }),
    getTranslations({ locale, namespace: "tournamentPage" }),
    getAdminTournament(id),
    getAdminTournamentStages(id),
  ]);
  if (!tournament) notFound();
  const activeStageId = sp.stage ? Number(sp.stage) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/tournaments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToTournament")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{tournament.name}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {stages.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{tOverview("noStages")}</p>
      ) : (
        <BracketViewerPanel tournamentId={id} stages={stages} activeStageId={activeStageId} />
      )}
    </div>
  );
}
