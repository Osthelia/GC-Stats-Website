/**
 * GC-Stats - admin-finance
 *
 * Admin queries for /admin/finance: paginated income/expense entries,
 * filtered totals, and single entry lookup.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, and, or, desc, asc, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { financeEntries } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export { FINANCE_CATEGORIES, type FinanceCategory } from "@/lib/finance-categories";

export type FinanceType = "income" | "expense";
export type FinanceSort = "date" | "label" | "category" | "amount";
export type SortDirection = "asc" | "desc";
export type FinanceTypeFilter = "" | FinanceType;

export type AdminFinanceEntry = {
  id: number;
  entryDate: string;
  type: FinanceType;
  category: string;
  label: string;
  description: string | null;
  amountUsd: string;
  amountEur: string;
  sourceUrl: string | null;
};

export const FINANCE_PAGE_SIZE = 30;

function financeConditions(q: string, type: FinanceTypeFilter) {
  const conditions = [];
  if (q) {
    const variants = typoVariants(q.toLowerCase());
    conditions.push(or(...variants.map((v) => foldedIlike(financeEntries.label, v))));
  }
  if (type) conditions.push(eq(financeEntries.type, type));
  return conditions.length ? and(...conditions) : undefined;
}

export async function listAdminFinanceEntries(opts: { q: string; type: FinanceTypeFilter; sort: FinanceSort; direction: SortDirection; page: number }): Promise<{ rows: AdminFinanceEntry[]; total: number }> {
  const { q, type, sort, direction, page } = opts;
  const where = financeConditions(q, type);

  const sortCol =
    sort === "label" ? financeEntries.label : sort === "category" ? financeEntries.category : sort === "amount" ? financeEntries.amountUsd : financeEntries.entryDate;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(financeEntries)
      .where(where)
      .orderBy(orderBy, desc(financeEntries.id))
      .limit(FINANCE_PAGE_SIZE)
      .offset((page - 1) * FINANCE_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(financeEntries).where(where),
  ]);

  return { rows: rows as AdminFinanceEntry[], total: Number(totalRows[0]?.total ?? 0) };
}

/** Income/expense sums over the full filtered set (not just the current page) — powers the stat cards above the (paginated) table. */
export async function getAdminFinanceTotals(opts: { q: string; type: FinanceTypeFilter }): Promise<{ income: number; expense: number }> {
  const where = financeConditions(opts.q, opts.type);
  const rows = await db
    .select({ type: financeEntries.type, total: sql<string>`coalesce(sum(${financeEntries.amountUsd}), 0)` })
    .from(financeEntries)
    .where(where)
    .groupBy(financeEntries.type);

  const result = { income: 0, expense: 0 };
  for (const row of rows) {
    if (row.type === "income") result.income = Number(row.total);
    else if (row.type === "expense") result.expense = Number(row.total);
  }
  return result;
}

export async function getAdminFinanceEntry(id: number): Promise<AdminFinanceEntry | null> {
  const [row] = await db.select().from(financeEntries).where(eq(financeEntries.id, id)).limit(1);
  return (row as AdminFinanceEntry) ?? null;
}
