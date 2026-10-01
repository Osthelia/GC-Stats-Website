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
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { listAdminOrganizations, ORGANIZATIONS_PAGE_SIZE, type OrganizationSort } from "@/lib/admin-organizations";
import { organizationTagStyle } from "@/lib/organization-tags";
import { countryNames } from "@/lib/countries";
import { CountryFlag } from "@/components/admin/country-flag";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog";

const SORT_VALUES: OrganizationSort[] = ["name", "members"];

type SearchParams = { q?: string; sort?: string; direction?: string; page?: string };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.organizations" });
  return { title: t("title") };
}

export default async function AdminOrganizationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.organizationsView);
  const t = await getTranslations({ locale, namespace: "admin.organizations" });
  const tTags = await getTranslations({ locale, namespace: "admin.organizations.tagOptions" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as OrganizationSort) : "name";
  const direction = sp.direction === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total } = await listAdminOrganizations({ q, sort, direction, page });
  const totalPages = Math.max(1, Math.ceil(total / ORGANIZATIONS_PAGE_SIZE));
  const thQuery = { q };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {hasAccess(access, PERMISSIONS.organizationsEdit) && <CreateOrganizationDialog />}
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
        statusValue=""
        statusLabel=""
        statusOptions={[]}
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTh pathname="/admin/organizations" col="name" label={t("columnName")} currentSort={sort} currentDirection={direction} query={thQuery} />
              <TableHead>{t("columnCountry")}</TableHead>
              <TableHead>{t("columnTags")}</TableHead>
              <AdminSortableTh pathname="/admin/organizations" col="members" label={t("columnMembers")} currentSort={sort} currentDirection={direction} query={thQuery} />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((organization) => (
              <TableRow key={organization.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/organizations/${organization.id}`} className="font-medium hover:underline">
                      {organization.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{organization.slug}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CountryFlag code={organization.countryCode} secondaryCode={organization.secondaryCountryCode} className="size-3.5 shrink-0" />
                    {countryNames(organization.countryCode, organization.secondaryCountryCode, locale as AppLocale) ?? "-"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {organization.tags.length === 0 && <span className="text-muted-foreground">-</span>}
                    {organization.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className={organizationTagStyle(tag)}>
                        {tTags.has(tag) ? tTags(tag) : tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{t("membersCount", { count: organization.memberCount })}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" render={<Link href={`/admin/organizations/${organization.id}`} />}>
                    {t("manage")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination pathname="/admin/organizations" page={page} totalPages={totalPages} total={total} query={{ ...thQuery, sort, direction }} label={`${total}`} />
    </div>
  );
}
