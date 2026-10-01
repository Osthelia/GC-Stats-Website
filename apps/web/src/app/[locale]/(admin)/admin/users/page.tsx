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
import { listAdminUsers, listGlobalRoles, USERS_PAGE_SIZE, type AdminUserSort, type SortDirection } from "@/lib/admin-users";
import { UsersTable } from "@/components/admin/users-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: AdminUserSort[] = ["username", "email", "createdAt", "lastLoginAt"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.users" });
  return { title: t("title") };
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const search = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as AdminUserSort) : "createdAt";
  const direction: SortDirection = sp.direction === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const t = await getTranslations({ locale, namespace: "admin.users" });

  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.usersView);
  const [{ rows, total }, globalRoles] = await Promise.all([listAdminUsers({ q: search, sort, direction, page }), listGlobalRoles()]);
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AdminSearchSortBar
        searchPlaceholder={t("searchPlaceholder")}
        searchSubmitLabel={t("searchSubmit")}
        searchValue={search}
        sort={sort}
        direction={direction}
        activeWithinValue=""
        activeWithinLabel=""
        activeWithinOptions={[]}
        statusValue=""
        statusLabel=""
        statusOptions={[]}
      />

      <UsersTable
        users={rows}
        globalRoles={globalRoles}
        canManageRoles={access.isSuperAdmin}
        canViewConnections={hasAccess(access, PERMISSIONS.usersViewConnections)}
        sortable={{ pathname: "/admin/users", sort, direction, query: { q: search, sort, direction } }}
      />

      <AdminPagination pathname="/admin/users" page={page} totalPages={totalPages} total={total} query={{ q: search, sort, direction }} label={`${total}`} />
    </div>
  );
}
