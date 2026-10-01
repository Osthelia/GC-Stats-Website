/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { FinanceTable } from "@/components/admin/finance-table";
import { CreateFinanceEntryButton } from "@/components/admin/create-finance-entry-button";
import { listAdminFinanceEntries, getAdminFinanceTotals, FINANCE_PAGE_SIZE, type FinanceSort, type FinanceTypeFilter } from "@/lib/admin-finance";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: FinanceSort[] = ["date", "label", "category", "amount"];
const TYPE_VALUES: FinanceTypeFilter[] = ["income", "expense"];

type SearchParams = { q?: string; sort?: string; direction?: string; status?: string; page?: string };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.finance" });
  return { title: t("title") };
}

export default async function AdminFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.financeView);
  const t = await getTranslations({ locale, namespace: "admin.finance" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as FinanceSort) : "date";
  const direction = sp.direction === "asc" ? "asc" : "desc";
  const type = (TYPE_VALUES as string[]).includes(sp.status ?? "") ? (sp.status as FinanceTypeFilter) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows: entries, total }, totals] = await Promise.all([
    listAdminFinanceEntries({ q, type, sort, direction, page }),
    getAdminFinanceTotals({ q, type }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / FINANCE_PAGE_SIZE));
  const thQuery = { q, status: type };

  const net = totals.income - totals.expense;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "USD" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {hasAccess(access, PERMISSIONS.financeManage) && <CreateFinanceEntryButton />}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminStatCard label={t("statIncome")} value={money.format(totals.income)} icon={TrendingUp} color="emerald" />
        <AdminStatCard label={t("statExpense")} value={money.format(totals.expense)} icon={TrendingDown} color="destructive" />
        <AdminStatCard label={t("statNet")} value={money.format(net)} icon={Scale} color={net >= 0 ? "emerald" : "destructive"} />
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
        statusValue={type}
        statusLabel={t("typeLabel")}
        statusOptions={[
          { value: "", label: t("typeAny") },
          { value: "income", label: t("typeIncome") },
          { value: "expense", label: t("typeExpense") },
        ]}
      />

      <FinanceTable entries={entries} sort={sort} direction={direction} query={thQuery} canManage={hasAccess(access, PERMISSIONS.financeManage)} />

      <AdminPagination pathname="/admin/finance" page={page} totalPages={totalPages} total={total} query={{ ...thQuery, sort, direction }} label={`${total}`} />
    </div>
  );
}
