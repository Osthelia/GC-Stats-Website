/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MessageSquare, EyeOff, Trash2 } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { ForumMessagesPanel } from "@/components/admin/forum-messages-panel";
import {
  listAdminForumMessages,
  getAdminForumMessageCounts,
  FORUM_MESSAGES_PAGE_SIZE,
  type ForumMessageSort,
  type ForumMessageStatus,
  type SortDirection,
} from "@/lib/admin-forum-messages";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: ForumMessageSort[] = ["createdAt", "status"];
const STATUS_VALUES: ForumMessageStatus[] = ["visible", "hidden", "deleted"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.forum" });
  return { title: t("title") };
}

export default async function AdminForumPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.forumView);
  const t = await getTranslations({ locale, namespace: "admin.forum" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as ForumMessageSort) : "createdAt";
  const direction: SortDirection = sp.direction === "asc" ? "asc" : "desc";
  const status = (STATUS_VALUES as string[]).includes(sp.status ?? "") ? (sp.status as ForumMessageStatus) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows, total }, counts] = await Promise.all([listAdminForumMessages({ q, status, sort, direction, page }), getAdminForumMessageCounts()]);
  const totalPages = Math.max(1, Math.ceil(total / FORUM_MESSAGES_PAGE_SIZE));
  const canManage = hasAccess(access, PERMISSIONS.forumManage);
  const canSanction = hasAccess(access, PERMISSIONS.sanctionsManage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminStatCard label={t("statVisible")} value={counts.visible} icon={MessageSquare} color="emerald" />
        <AdminStatCard label={t("statHidden")} value={counts.hidden} icon={EyeOff} color="amber" />
        <AdminStatCard label={t("statDeleted")} value={counts.deleted} icon={Trash2} color="destructive" />
      </div>

      <AdminSearchSortBar
        searchPlaceholder={t("searchPlaceholder")}
        searchSubmitLabel={t("searchSubmit")}
        searchValue={q}
        sort={sort}
        direction={direction}
        activeWithinValue=""
        activeWithinLabel=""
        activeWithinOptions={[]}
        statusValue={status}
        statusLabel={t("statusLabel")}
        statusOptions={[
          { value: "", label: t("statusAny") },
          { value: "visible", label: t("status.visible") },
          { value: "hidden", label: t("status.hidden") },
          { value: "deleted", label: t("status.deleted") },
        ]}
      />

      <ForumMessagesPanel
        rows={rows}
        canManage={canManage}
        canSanction={canSanction}
        sortable={{ pathname: "/admin/forum", sort, direction, query: { q, status, sort, direction } }}
      />

      <AdminPagination pathname="/admin/forum" page={page} totalPages={totalPages} total={total} query={{ q, status, sort, direction }} label={`${total}`} />
    </div>
  );
}
