/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAuthorAccess } from "@/lib/dashboard-rbac";
import { listActiveNewsLanguages } from "@/lib/news-languages";
import type { AppLocale } from "@/i18n/routing";
import { NewsEditorForm } from "@/components/dashboard/news/news-editor-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.news.editor" });
  return { title: t("createTitle") };
}

export default async function DashboardAuthorNewNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAuthorAccess(locale as AppLocale);
  const languages = await listActiveNewsLanguages();

  return <NewsEditorForm organizationId={null} article={null} messages={[]} languages={languages} canEdit canPublish={false} canDelete={false} listHref="/dashboard/author" />;
}
