/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { EmotesPanel } from "@/components/admin/emotes-panel";
import { listAdminEmotes, listEmoteSources, EMOTES_PAGE_SIZE, type EmoteSort, type EmoteStatusFilter, type SortDirection } from "@/lib/admin-emotes";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: EmoteSort[] = ["name", "source", "status"];
const STATUS_VALUES: EmoteStatusFilter[] = ["active", "inactive"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.emotes" });
  return { title: t("title") };
}

export default async function AdminEmotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.emotesView);
  const t = await getTranslations({ locale, namespace: "admin.emotes" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as EmoteSort) : "name";
  const direction: SortDirection = sp.direction === "desc" ? "desc" : "asc";
  const status = (STATUS_VALUES as string[]).includes(sp.status ?? "") ? (sp.status as EmoteStatusFilter) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows, total }, existingSources] = await Promise.all([listAdminEmotes({ q, sort, direction, status, page }), listEmoteSources()]);
  const canManage = hasAccess(access, PERMISSIONS.emotesManage);
  const totalPages = Math.max(1, Math.ceil(total / EMOTES_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
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
          { value: "active", label: t("statusActive") },
          { value: "inactive", label: t("statusInactive") },
        ]}
      />

      <EmotesPanel
        emotes={rows}
        canManage={canManage}
        sortable={{ pathname: "/admin/emotes", sort, direction, query: { q, status, sort, direction } }}
        pagination={{ page, totalPages, total }}
        existingSources={existingSources}
      />
    </div>
  );
}
