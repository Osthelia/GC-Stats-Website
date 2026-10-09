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
import { ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgAccess, hasOrgPermission } from "@/lib/dashboard-rbac";
import { getAdminOrganization } from "@/lib/admin-organizations";
import { listOrganizationStreamChannelRows, listOrganizationStreamLinks } from "@/lib/dashboard-streams-data";
import { listActiveNewsLanguages } from "@/lib/news-languages";
import { parseEntityId } from "@/lib/entity-id";
import { getOrganizationLinkedTeams } from "@/lib/organization-team-link";
import type { AppLocale } from "@/i18n/routing";
import { OrgStreamsPanel } from "@/components/dashboard/org-streams-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.streams" });
  return { title: t("title") };
}

export default async function DashboardOrganizationStreamsPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  const t = await getTranslations({ locale, namespace: "dashboard.streams" });
  const canView = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.streamsView);

  if (!canView) {
    const organization = await getAdminOrganization(id);
    if (!organization) notFound();
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("readOnlyHint")}</p>
      </div>
    );
  }

  const [organization, channels, links, languages, linkedTeams] = await Promise.all([
    getAdminOrganization(id),
    listOrganizationStreamChannelRows(id),
    listOrganizationStreamLinks(id),
    listActiveNewsLanguages(),
    getOrganizationLinkedTeams(id),
  ]);
  if (!organization) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {linkedTeams.length > 0 && (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("teamScopeHint", { teams: linkedTeams.map((team) => team.name).join(", ") })}</p>
      )}
      <OrgStreamsPanel
        organizationId={id}
        initialChannels={channels}
        initialLinks={links}
        languages={languages}
        canView={canView}
        canEdit={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.streamsEdit)}
        canDelete={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.streamsDelete)}
        canLink={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.streamsLink)}
      />
    </div>
  );
}
