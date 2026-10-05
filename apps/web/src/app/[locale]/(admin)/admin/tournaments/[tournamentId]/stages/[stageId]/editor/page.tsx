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
import { getStageEditorData } from "@/lib/admin-bracket-editor-data";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { BracketEditorCanvas } from "@/components/admin/bracket-editor/bracket-editor-canvas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; stageId: string }> }): Promise<Metadata> {
  const { locale, stageId } = await params;
  const id = Number(stageId);
  const data = Number.isInteger(id) ? await getStageEditorData(id) : null;
  if (data) return { title: data.stageName };
  const t = await getTranslations({ locale, namespace: "admin.tournaments.editor" });
  return { title: t("title") };
}

export default async function AdminBracketEditorPage({ params }: { params: Promise<{ locale: string; tournamentId: string; stageId: string }> }) {
  const { locale, tournamentId, stageId } = await params;
  const id = Number(stageId);
  if (!Number.isInteger(id)) notFound();

  const [, t, data] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsManage),
    getTranslations({ locale, namespace: "admin.tournaments.editor" }),
    getStageEditorData(id),
  ]);
  if (!data) notFound();

  const swissContainers = data.containers.filter((c) => c.containerType === "group" && (c.config as { type?: string } | null)?.type === "swiss");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Link href={`/admin/tournaments/${tournamentId}/bracket-editor`} className="text-sm text-muted-foreground hover:text-foreground">
            {t("backToTournament")}
          </Link>
          <Link href={`/admin/tournaments/${tournamentId}/stages/${stageId}/legacy-import`} className="text-sm text-muted-foreground hover:text-foreground">
            {t("legacyImportLink")}
          </Link>
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{data.stageName}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {swissContainers.length > 0 && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("swissContainersNotice", { names: swissContainers.map((c) => c.name).join(", ") })}</p>
      )}

      <BracketEditorCanvas
        tournamentId={Number(tournamentId)}
        stageId={data.stageId}
        stageStatus={data.stageStatus}
        containers={data.containers}
        initialMatches={data.matches}
        initialEdges={data.edges}
        entrants={data.entrants}
      />
    </div>
  );
}
