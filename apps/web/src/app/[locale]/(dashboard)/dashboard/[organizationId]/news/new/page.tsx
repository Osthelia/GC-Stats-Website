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
import { requireDashboardOrgPermission } from "@/lib/dashboard-rbac";
import { listActiveNewsLanguages } from "@/lib/news-languages";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { NewsEditorForm } from "@/components/dashboard/news/news-editor-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.news.editor" });
  return { title: t("createTitle") };
}

export default async function DashboardOrganizationNewNewsPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  await requireDashboardOrgPermission(locale as AppLocale, id, ORGANIZATION_PERMISSIONS.newsEdit);
  const languages = await listActiveNewsLanguages();

  return <NewsEditorForm organizationId={id} article={null} messages={[]} languages={languages} canEdit canPublish={false} canDelete={false} listHref={`/dashboard/${id}/news`} />;
}
