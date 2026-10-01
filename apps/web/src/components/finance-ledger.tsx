/**
 * GC-Stats - finance-ledger
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { SectionCard, SmallCard, icons } from "@/components/legal/ui";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";

type Currency = "USD" | "EUR";

export type FinanceLedgerEntry = {
  id: number;
  entryDate: string;
  type: string;
  category: string;
  label: string;
  amountUsd: string;
  amountEur: string;
};

const CURRENCIES: Currency[] = ["USD", "EUR"];

export function FinanceLedger({ entries }: { entries: FinanceLedgerEntry[] }) {
  const t = useTranslations("financePage");
  const locale = useLocale();
  const [currency, setCurrency] = useState<Currency>("USD");

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }), [locale]);

  const amountOf = (entry: FinanceLedgerEntry) => Number(currency === "USD" ? entry.amountUsd : entry.amountEur);

  const categoryLabel = (category: string) =>
    (FINANCE_CATEGORIES as readonly string[]).includes(category) ? t(`category.${category}`) : category;

  const { avgIncome, avgExpense, avgNet, monthCount } = useMemo(() => {
    const monthlyTotals = new Map<string, { income: number; expense: number }>();
    for (const entry of entries) {
      const month = entry.entryDate.slice(0, 7);
      const bucket = monthlyTotals.get(month) ?? { income: 0, expense: 0 };
      const amount = amountOf(entry);
      if (entry.type === "income") bucket.income += amount;
      else bucket.expense += amount;
      monthlyTotals.set(month, bucket);
    }
    const count = monthlyTotals.size || 1;
    const totalIncome = [...monthlyTotals.values()].reduce((sum, m) => sum + m.income, 0);
    const totalExpense = [...monthlyTotals.values()].reduce((sum, m) => sum + m.expense, 0);
    const income = totalIncome / count;
    const expense = totalExpense / count;
    return { avgIncome: income, avgExpense: expense, avgNet: income - expense, monthCount: monthlyTotals.size };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, currency]);

  return (
    <>
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-[var(--gcs-surface)] p-1">
          {CURRENCIES.map((c) => {
            const on = currency === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCurrency(c)}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold tracking-tight transition-all hover:-translate-y-px active:translate-y-0"
                style={{
                  background: on ? "#e4ae22" : "transparent",
                  color: on ? "#0e0e0e" : "var(--gcs-text-secondary)",
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 pt-2 sm:grid-cols-3">
        <SmallCard title={t("avgIncome")}>
          <p className="text-2xl font-semibold text-emerald-400">{money.format(avgIncome)}</p>
        </SmallCard>
        <SmallCard title={t("avgExpense")}>
          <p className="text-2xl font-semibold text-red-400">{money.format(avgExpense)}</p>
        </SmallCard>
        <SmallCard title={t("avgNet")}>
          <p className={`text-2xl font-semibold ${avgNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>{money.format(avgNet)}</p>
        </SmallCard>
      </div>

      <p className="text-center text-xs font-medium text-neutral-500">{t("basedOn", { count: monthCount })}</p>

      <SectionCard icon={icons.chart} title={t("ledgerTitle")}>
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-white/5">
                {entries
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-neutral-500">{dateFormat.format(new Date(entry.entryDate))}</td>
                      <td className="py-2.5 pr-4 text-neutral-300">{entry.label}</td>
                      <td className="py-2.5 pr-4 text-xs text-neutral-500">{categoryLabel(entry.category)}</td>
                      <td className={`whitespace-nowrap py-2.5 text-right font-medium ${entry.type === "income" ? "text-emerald-400" : "text-red-400"}`}>
                        {entry.type === "income" ? "+" : "-"}
                        {money.format(amountOf(entry))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
