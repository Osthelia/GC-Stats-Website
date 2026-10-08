/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAuthorAdminAccess } from "@/lib/dashboard-rbac";
import { listDashboardAuthors } from "@/lib/dashboard-authors-data";
import type { AppLocale } from "@/i18n/routing";
import { AuthorsListTable } from "@/components/dashboard/authors/authors-list-table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.authors" });
  return { title: t("title") };
}

export default async function DashboardAuthorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAuthorAdminAccess(locale as AppLocale);

  const authors = await listDashboardAuthors();

  return <AuthorsListTable authors={authors} />;
}
