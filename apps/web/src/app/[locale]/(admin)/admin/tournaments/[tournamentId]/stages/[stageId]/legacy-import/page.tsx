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
import { LegacyImportWorkspace } from "@/components/admin/legacy-import/legacy-import-workspace";

function isLegacyTarget(config: unknown): boolean {
  return (config as { legacyImportTarget?: boolean } | null)?.legacyImportTarget === true;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; stageId: string }> }): Promise<Metadata> {
  const { locale, stageId } = await params;
  const id = Number(stageId);
  const data = Number.isInteger(id) ? await getStageEditorData(id) : null;
  const t = await getTranslations({ locale, namespace: "admin.tournaments.legacyImport" });
  return { title: data ? `${t("title")} — ${data.stageName}` : t("title") };
}

export default async function AdminLegacyBracketImportPage({ params }: { params: Promise<{ locale: string; tournamentId: string; stageId: string }> }) {
  const { locale, tournamentId, stageId } = await params;
  const id = Number(stageId);
  if (!Number.isInteger(id)) notFound();

  await requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsManage);
  const t = await getTranslations({ locale, namespace: "admin.tournaments.legacyImport" });

  const data = await getStageEditorData(id);
  if (!data) notFound();

  const targetContainers = data.containers.filter((c) => isLegacyTarget(c.config));
  const targetContainerIds = new Set(targetContainers.map((c) => c.id));
  const targetMatches = data.matches.filter((m) => targetContainerIds.has(m.containerId));
  const targetEdges = data.edges.filter((e) => targetMatches.some((m) => m.id === e.fromMatchId));
  const poolMatches = data.matches.filter((m) => !targetContainerIds.has(m.containerId));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/tournaments/${tournamentId}/stages/${id}/editor`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToEditor")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{data.stageName}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <LegacyImportWorkspace
        stageId={data.stageId}
        tournamentId={data.tournamentId}
        poolMatches={poolMatches}
        targetContainers={targetContainers}
        targetMatches={targetMatches}
        targetEdges={targetEdges}
        entrants={data.entrants}
      />
    </div>
  );
}
