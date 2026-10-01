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
import { getDashboardNewsArticle, listDashboardNewsMessages } from "@/lib/dashboard-news-data";
import { listActiveNewsLanguages } from "@/lib/news-languages";
import { parseEntityId } from "@/lib/entity-id";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { NewsEditorForm } from "@/components/dashboard/news/news-editor-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.news.editor" });
  return { title: t("editTitle") };
}

export default async function DashboardOrganizationEditNewsPage({ params }: { params: Promise<{ locale: string; organizationId: string; newsId: string }> }) {
  const { locale, organizationId, newsId } = await params;
  const id = parseEntityId(organizationId);
  const articleId = parseEntityId(newsId);
  if (id === null || articleId === null) notFound();

  const { membership } = await requireDashboardOrgPermission(locale as AppLocale, id, ORGANIZATION_PERMISSIONS.newsView);
  const canEdit = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsEdit);
  const canEditPublished = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsEditPublished);
  const canReview = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsReview);
  const canPublish = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsPublish);
  const canDelete = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsDelete);

  const [article, languages] = await Promise.all([getDashboardNewsArticle({ organizationId: id }, articleId), listActiveNewsLanguages()]);
  if (!article) notFound();

  if (!canEdit && !canEditPublished && !canReview && !canPublish) {
    // Pure viewers (organization.news.view only) can reach this URL from the
    // list, so send them back rather than 404ing on a page they can
    // legitimately list from. A reviewer or publisher (even without
    // news.edit) DOES belong here: they need this exact page to approve/
    // request changes/publish, see NewsStatusActions.
    redirect({ href: `/dashboard/${id}/news`, locale: locale as AppLocale });
  }

  const messages = await listDashboardNewsMessages(article.id);

  return (
    <NewsEditorForm
      organizationId={id}
      article={article}
      messages={messages}
      languages={languages}
      canEdit={canEdit}
      canEditPublished={canEditPublished}
      canReview={canReview}
      canPublish={canPublish}
      canDelete={canDelete}
      listHref={`/dashboard/${id}/news`}
    />
  );
}
