/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import { getVetoManagementData } from "@/lib/veto/management-data";
import type { AppLocale } from "@/i18n/routing";
import { VetoEnableCard } from "@/components/veto/veto-enable-card";
import { VetoManagementPanel } from "@/components/veto/veto-management-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.vetoManagement" });
  return { title: t("title") };
}

export default async function AdminTournamentVetoPage({ params }: { params: Promise<{ locale: string; tournamentId: string }> }) {
  const { locale, tournamentId } = await params;
  const id = Number(tournamentId);
  if (!Number.isInteger(id)) notFound();

  const [access, t, data] = await Promise.all([
    requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView),
    getTranslations({ locale, namespace: "admin.vetoManagement" }),
    getVetoManagementData(id),
  ]);
  if (!data) notFound();
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/tournaments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        {t("backToTournament", { name: data.tournament.name })}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <VetoEnableCard tournamentId={id} enabled={data.tournament.vetoEnabled} canManage={canManage} />
      {data.tournament.vetoEnabled && canManage && <VetoManagementPanel data={data} scope={{}} />}
    </div>
  );
}
