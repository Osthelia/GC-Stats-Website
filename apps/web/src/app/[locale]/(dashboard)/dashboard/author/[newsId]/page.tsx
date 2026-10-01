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
import { requireAuthorAccess } from "@/lib/dashboard-rbac";
import { getDashboardNewsArticle, findMyAuthorId, listDashboardNewsMessages } from "@/lib/dashboard-news-data";
import { listActiveNewsLanguages } from "@/lib/news-languages";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { NewsEditorForm } from "@/components/dashboard/news/news-editor-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.news.editor" });
  return { title: t("editTitle") };
}

export default async function DashboardAuthorEditNewsPage({ params }: { params: Promise<{ locale: string; newsId: string }> }) {
  const { locale, newsId } = await params;
  const articleId = parseEntityId(newsId);
  if (articleId === null) notFound();

  const { userId } = await requireAuthorAccess(locale as AppLocale);
  const authorId = await findMyAuthorId(userId);
  if (authorId === null) notFound();

  const [article, languages] = await Promise.all([getDashboardNewsArticle({ authorId }, articleId), listActiveNewsLanguages()]);
  if (!article) notFound();

  const messages = await listDashboardNewsMessages(article.id);

  return <NewsEditorForm organizationId={null} article={article} messages={messages} languages={languages} canEdit canPublish canDelete listHref="/dashboard/author" />;
}
