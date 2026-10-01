/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { requireAuthorAccess } from "@/lib/dashboard-rbac";
import { listDashboardNewsArticles, findMyAuthorId } from "@/lib/dashboard-news-data";
import type { AppLocale } from "@/i18n/routing";
import { NewsListTable } from "@/components/dashboard/news/news-list-table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.news" });
  return { title: t("title") };
}

export default async function DashboardAuthorNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { userId } = await requireAuthorAccess(locale as AppLocale);

  const [authorId, session] = await Promise.all([findMyAuthorId(userId), auth()]);
  const articles = authorId !== null ? await listDashboardNewsArticles({ authorId }) : [];
  const username = session?.user?.username;

  return <NewsListTable articles={articles} listHref="/dashboard/author" canCreate publicHref={username ? `/user/${username}/news` : undefined} />;
}
