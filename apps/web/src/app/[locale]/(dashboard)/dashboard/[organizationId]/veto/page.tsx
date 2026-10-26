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
import { ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { requireDashboardOrgAccess, hasOrgPermission } from "@/lib/dashboard-rbac";
import { parseEntityId } from "@/lib/entity-id";
import { getVetoManagementData, listOrganizerVetoTournaments } from "@/lib/veto/management-data";
import type { AppLocale } from "@/i18n/routing";
import { VetoManagementPanel } from "@/components/veto/veto-management-panel";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.veto" });
  return { title: t("title") };
}

export default async function DashboardOrganizationVetoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
  searchParams: Promise<{ tournament?: string }>;
}) {
  const [{ locale, organizationId }, { tournament }] = await Promise.all([params, searchParams]);
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  const t = await getTranslations({ locale, namespace: "dashboard.veto" });
  const canManage = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.vetoManage);

  const header = (
    <div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
    </div>
  );

  if (!canManage) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("readOnlyHint")}</p>
      </div>
    );
  }

  const tournaments = await listOrganizerVetoTournaments(id);
  const selected = tournaments.find((row) => String(row.id) === tournament) ?? tournaments[0] ?? null;
  const data = selected ? await getVetoManagementData(selected.id) : null;

  return (
    <div className="flex flex-col gap-6">
      {header}
      {tournaments.length === 0 && <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("noTournaments")}</p>}
      {tournaments.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {tournaments.map((row) => (
            <Link
              key={row.id}
              href={`/dashboard/${id}/veto?tournament=${row.id}`}
              className={cn("rounded-lg border px-3 py-1.5 text-sm transition-all active:scale-95", row.id === selected?.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {row.name}
            </Link>
          ))}
        </nav>
      )}
      {data && <VetoManagementPanel data={data} scope={{ organizationId: id }} />}
    </div>
  );
}
