/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { CreateRoleDialog } from "@/components/admin/create-role-dialog";
import { listGlobalRolesWithCounts, ROLES_PAGE_SIZE, type AdminRoleSort, type SortDirection } from "@/lib/admin-roles";
import { requireAdminAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: AdminRoleSort[] = ["name", "memberCount", "permissionCount"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.roles" });
  return { title: t("title") };
}

export default async function AdminRolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const search = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as AdminRoleSort) : "name";
  const direction: SortDirection = sp.direction === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const t = await getTranslations({ locale, namespace: "admin.roles" });

  // Role/permission management is super-admin-only, not permission-gated —
  // see packages/db/src/permissions.ts. requireAdminAccess() alone isn't
  // enough here (it only checks admin.access), so we re-check explicitly.
  const access = await requireAdminAccess(locale as AppLocale);
  if (!access.isSuperAdmin) redirect({ href: "/admin", locale: locale as AppLocale });

  const { rows, total } = await listGlobalRolesWithCounts({ q: search, sort, direction, page });
  const totalPages = Math.max(1, Math.ceil(total / ROLES_PAGE_SIZE));
  const sortable = { pathname: "/admin/roles", sort, direction, query: { q: search, sort, direction } };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <CreateRoleDialog />
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

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTh pathname={sortable.pathname} col="name" label={t("columnName")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="memberCount" label={t("columnMembers")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="permissionCount" label={t("columnPermissions")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/roles/${role.id}`} className="font-medium hover:underline">
                      {role.name}
                    </Link>
                    {role.isSuperAdmin && (
                      <Badge variant="outline" className="border-violet-400/20 bg-violet-400/10 text-violet-300">
                        {t("protectedBadge")}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{t("membersCount", { count: role.memberCount })}</TableCell>
                <TableCell className="text-muted-foreground">
                  {role.isSuperAdmin ? t("allPermissions") : t("permissionsCount", { count: role.permissionCount })}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" render={<Link href={`/admin/roles/${role.id}`} />}>
                    {t("manage")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination pathname="/admin/roles" page={page} totalPages={totalPages} total={total} query={sortable.query} label={`${total}`} />
    </div>
  );
}
