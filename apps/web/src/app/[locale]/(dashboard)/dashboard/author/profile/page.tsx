/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireNewsWriterAccess } from "@/lib/dashboard-rbac";
import { getMyAuthorProfile } from "@/actions/dashboard-author";
import type { AppLocale } from "@/i18n/routing";
import { AuthorProfileForm } from "@/components/dashboard/news/author-profile-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.author" });
  return { title: t("title") };
}

export default async function DashboardAuthorProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireNewsWriterAccess(locale as AppLocale);
  const profile = await getMyAuthorProfile();

  return <AuthorProfileForm profile={profile} />;
}
