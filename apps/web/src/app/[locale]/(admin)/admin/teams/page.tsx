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
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { GhostBadge } from "@/components/admin/ghost-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { listAdminTeams, TEAMS_PAGE_SIZE, type TeamSort, type ActiveWithin, type StatusFilter } from "@/lib/admin-teams";
import { countryNames } from "@/lib/countries";
import { CountryFlag } from "@/components/admin/country-flag";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { CreateTeamDialog } from "@/components/admin/create-team-dialog";

const SORT_VALUES: TeamSort[] = ["name", "country", "lastActivity"];
const ACTIVE_WITHIN_VALUES: ActiveWithin[] = ["60d", "120d"];
const STATUS_VALUES: StatusFilter[] = ["active", "inactive"];

type SearchParams = { q?: string; sort?: string; direction?: string; activeWithin?: string; status?: string; page?: string };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.teams" });
  return { title: t("title") };
}

export default async function AdminTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.teamsView);
  const t = await getTranslations({ locale, namespace: "admin.teams" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as TeamSort) : "name";
  const direction = sp.direction === "desc" ? "desc" : "asc";
  const activeWithin = (ACTIVE_WITHIN_VALUES as string[]).includes(sp.activeWithin ?? "") ? (sp.activeWithin as ActiveWithin) : "";
  const status = (STATUS_VALUES as string[]).includes(sp.status ?? "") ? (sp.status as StatusFilter) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total } = await listAdminTeams({ q, sort, direction, activeWithin, status, page });
  const totalPages = Math.max(1, Math.ceil(total / TEAMS_PAGE_SIZE));
  const thQuery = { q, activeWithin, status };
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {hasAccess(access, PERMISSIONS.teamsCreate) && <CreateTeamDialog />}
      </div>

      <AdminSearchSortBar
        searchPlaceholder={t("searchPlaceholder")}
        searchSubmitLabel={t("searchSubmit")}
        searchValue={q}
        sort={sort}
        direction={direction}
        activeWithinValue={activeWithin}
        activeWithinLabel={t("activeWithinLabel")}
        activeWithinOptions={[
          { value: "", label: t("activeWithinAny") },
          { value: "60d", label: t("activeWithin60") },
          { value: "120d", label: t("activeWithin120") },
        ]}
        statusValue={status}
        statusLabel={t("statusLabel")}
        statusOptions={[
          { value: "", label: t("statusAny") },
          { value: "active", label: t("statusActive") },
          { value: "inactive", label: t("statusInactive") },
        ]}
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTh pathname="/admin/teams" col="name" label={t("columnName")} currentSort={sort} currentDirection={direction} query={thQuery} />
              <AdminSortableTh pathname="/admin/teams" col="country" label={t("columnCountry")} currentSort={sort} currentDirection={direction} query={thQuery} />
              <TableHead>{t("columnRoster")}</TableHead>
              <AdminSortableTh pathname="/admin/teams" col="lastActivity" label={t("columnLastActivity")} currentSort={sort} currentDirection={direction} query={thQuery} />
              <TableHead>{t("columnStatus")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((team) => (
              <TableRow key={team.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/teams/${team.id}`} className="font-medium hover:underline">
                      {team.name}
                    </Link>
                    {team.shortName && <span className="text-xs text-muted-foreground">{team.shortName}</span>}
                    {team.isGhost && <GhostBadge />}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CountryFlag code={team.countryCode} secondaryCode={team.secondaryCountryCode} className="size-3.5 shrink-0" />
                    {countryNames(team.countryCode, team.secondaryCountryCode, locale as AppLocale) ?? "–"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{t("membersCount", { count: team.rosterCount })}</TableCell>
                <TableCell className="text-muted-foreground">{team.lastActivityAt ? dateFmt.format(team.lastActivityAt) : t("never")}</TableCell>
                <TableCell>
                  <ActiveStatusBadge active={team.isActive} activeLabel={t("statusActive")} inactiveLabel={t("statusInactive")} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" render={<Link href={`/admin/teams/${team.id}`} />}>
                    {t("manage")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination pathname="/admin/teams" page={page} totalPages={totalPages} total={total} query={{ ...thQuery, sort, direction }} label={`${total}`} />
    </div>
  );
}
