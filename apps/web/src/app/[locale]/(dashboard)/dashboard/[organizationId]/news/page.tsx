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
import { requireDashboardOrgPermission, hasOrgPermission } from "@/lib/dashboard-rbac";
import { listDashboardNewsArticles } from "@/lib/dashboard-news-data";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { NewsListTable } from "@/components/dashboard/news/news-list-table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.news" });
  return { title: t("title") };
}

export default async function DashboardOrganizationNewsPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgPermission(locale as AppLocale, id, ORGANIZATION_PERMISSIONS.newsView);
  const canEdit = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsEdit);

  const articles = await listDashboardNewsArticles({ organizationId: id });

  return (
    <NewsListTable
      articles={articles}
      listHref={`/dashboard/${id}/news`}
      canCreate={canEdit}
      canEdit={canEdit}
      showAuthorProfileLink={canEdit}
      publicHref={`/organization/${id}/${membership.organizationSlug}/news`}
    />
  );
}
