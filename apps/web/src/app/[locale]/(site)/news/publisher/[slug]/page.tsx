/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getPublicOrganizationRedirectSegment } from "@/lib/news-page-data";
import type { AppLocale } from "@/i18n/routing";

// Publishers are organizations now, this URL only exists for old shared/indexed links, permanently redirected to the real organization page.
export default async function NewsPublisherRedirectPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const segment = await getPublicOrganizationRedirectSegment(slug);
  if (!segment) notFound();

  redirect({ href: `/organization/${segment}`, locale: locale as AppLocale });
}
