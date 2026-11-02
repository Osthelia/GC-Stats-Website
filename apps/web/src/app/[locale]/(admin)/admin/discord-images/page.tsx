/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { DiscordImageHistoryPanel } from "@/components/admin/discord-image-history-panel";
import { DiscordImageReviewsPanel } from "@/components/admin/discord-image-reviews-panel";
import { DISCORD_IMAGE_HISTORY_PAGE_SIZE, DISCORD_IMAGE_REVIEWS_PAGE_SIZE, listDiscordImageDecisions, listPendingDiscordImages } from "@/lib/admin-discord-image-reviews";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.moderation.images" });
  return { title: t("title") };
}

export default async function AdminDiscordImagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; historyPage?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.moderationView);
  const t = await getTranslations({ locale, namespace: "admin.moderation.images" });

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const historyPage = Math.max(1, Number.parseInt(sp.historyPage ?? "1", 10) || 1);
  const [{ rows, total }, history] = await Promise.all([listPendingDiscordImages(page), listDiscordImageDecisions(historyPage)]);
  const totalPages = Math.max(1, Math.ceil(total / DISCORD_IMAGE_REVIEWS_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <DiscordImageReviewsPanel rows={rows} canManage={hasAccess(access, PERMISSIONS.moderationManage)} />

      <AdminPagination pathname="/admin/discord-images" page={page} totalPages={totalPages} total={total} query={{ historyPage: String(historyPage) }} label={`${total}`} />

      <div>
        <h2 className="text-lg font-semibold">{t("history.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("history.subtitle")}</p>
      </div>

      <DiscordImageHistoryPanel rows={history.rows} locale={locale} />

      <AdminPagination
        pathname="/admin/discord-images"
        page={historyPage}
        totalPages={Math.max(1, Math.ceil(history.total / DISCORD_IMAGE_HISTORY_PAGE_SIZE))}
        total={history.total}
        query={{ page: String(page) }}
        label={`${history.total}`}
        pageParam="historyPage"
      />
    </div>
  );
}
