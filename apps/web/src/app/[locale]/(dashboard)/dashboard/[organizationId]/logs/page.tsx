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
import { redirect } from "@/i18n/navigation";
import { ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgAccess, hasOrgPermission } from "@/lib/dashboard-rbac";
import { listOrganizationActivityLog, getOrganizationActivityLogFilterOptions, ORG_ACTIVITY_LOG_PAGE_SIZE } from "@/lib/organization-activity-log";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { OrgActivityLogPanel } from "@/components/dashboard/org-activity-log-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.logs" });
  return { title: t("title") };
}

export default async function DashboardOrganizationLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
  searchParams: Promise<{ q?: string; subject?: string; event?: string; page?: string }>;
}) {
  const { locale, organizationId } = await params;
  const sp = await searchParams;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  if (!hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.logsView)) redirect({ href: `/dashboard/${id}`, locale: locale as AppLocale });

  const t = await getTranslations({ locale, namespace: "dashboard.logs" });
  const { subjects, events } = await getOrganizationActivityLogFilterOptions(id);

  const q = (sp.q ?? "").trim();
  const subject = subjects.includes(sp.subject ?? "") ? (sp.subject ?? "") : "";
  const event = events.includes(sp.event ?? "") ? (sp.event ?? "") : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total } = await listOrganizationActivityLog(id, { q, subject, event, page });
  const totalPages = Math.max(1, Math.ceil(total / ORG_ACTIVITY_LOG_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <OrgActivityLogPanel rows={rows} total={total} page={page} totalPages={totalPages} q={q} subject={subject} event={event} subjects={subjects} events={events} />
    </div>
  );
}
