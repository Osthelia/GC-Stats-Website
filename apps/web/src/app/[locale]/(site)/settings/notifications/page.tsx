/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/session";
import { listNotifications } from "@/lib/notify";
import { SettingsNav } from "@/components/settings/settings-nav";
import { NotificationListActions } from "@/components/settings/notification-list-actions";
import { FormattedDate } from "@/components/formatted-date";
import { ListPagination } from "@/components/filters/list-pagination";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "notifications" });
  return { title: t("title") };
}

export default async function NotificationsSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; unread?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam, unread } = await searchParams;
  setRequestLocale(locale as AppLocale);

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: "/login", locale: locale as AppLocale });
    return null;
  }

  const unreadOnly = unread === "1";
  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, totalPages } = await listNotifications(userId, { page, unreadOnly });

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "notifications" });

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-16 pb-28">
      <div className="mb-8">
        <h1 className="mb-2 text-[28px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
        <p className="text-[14.5px] text-neutral-400">{t("subtitle")}</p>
      </div>

      <SettingsNav active="notifications" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface-2)] p-[3px]">
          <Link
            href="/settings/notifications"
            className="rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{ background: !unreadOnly ? "var(--gcs-hover-2)" : "transparent", color: !unreadOnly ? "var(--gcs-text)" : "var(--gcs-text-secondary)" }}
          >
            {t("filterAll")}
          </Link>
          <Link
            href="/settings/notifications?unread=1"
            className="rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{ background: unreadOnly ? "var(--gcs-hover-2)" : "transparent", color: unreadOnly ? "var(--gcs-text)" : "var(--gcs-text-secondary)" }}
          >
            {t("filterUnread")}
          </Link>
        </div>
        <NotificationListActions />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/notifications/${row.id}/open`}
              className="flex items-start gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-4 transition-all hover:translate-x-1 hover:border-neutral-700"
            >
              {!row.readAt && <span aria-hidden="true" className="mt-1.5 h-[8px] w-[8px] flex-none rounded-full bg-[#e4ae22]" />}
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-neutral-50">{t(`type.${row.type}.title`, row.data as Record<string, string | number>)}</p>
                <p className="mt-0.5 text-[13px] text-neutral-400">{t(`type.${row.type}.body`, row.data as Record<string, string | number>)}</p>
              </div>
              <span className="flex-none text-[11.5px] text-neutral-600">
                <FormattedDate date={row.createdAt} mode="datetime" />
              </span>
            </Link>
          ))}
        </div>
      )}

      <ListPagination
        page={page}
        totalPages={totalPages}
        prevHref={`/settings/notifications?page=${page - 1}${unreadOnly ? "&unread=1" : ""}`}
        nextHref={`/settings/notifications?page=${page + 1}${unreadOnly ? "&unread=1" : ""}`}
        previousLabel={t("previous")}
        nextLabel={t("next")}
        pageOfLabel={t("pageOf", { page, total: totalPages })}
      />
    </div>
  );
}
