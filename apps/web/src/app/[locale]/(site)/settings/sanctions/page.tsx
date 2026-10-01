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
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/session";
import { listOwnSanctions } from "@/lib/settings-sanctions";
import { SANCTION_COLORS } from "@/lib/sanction-constants";
import { SettingsNav } from "@/components/settings/settings-nav";
import { FormattedDate } from "@/components/formatted-date";
import { ListPagination } from "@/components/filters/list-pagination";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.sanctions" });
  return { title: t("title") };
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-[#e08585]/10 text-[#e08585] border-[#e08585]/20",
  expired: "bg-neutral-800 text-neutral-400 border-neutral-700",
  revoked: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
};

function toHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export default async function MySanctionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  setRequestLocale(locale as AppLocale);

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: "/login", locale: locale as AppLocale });
    return null;
  }

  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, totalPages } = await listOwnSanctions(userId, page);

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.sanctions" });

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-16 pb-28">
      <div className="mb-8">
        <h1 className="mb-2 text-[28px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
        <p className="text-[14.5px] text-neutral-400">{t("subtitle")}</p>
      </div>

      <SettingsNav active="sanctions" />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/settings/sanctions/${row.id}`}
              className="flex items-center gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-4 transition-all hover:translate-x-1 hover:border-neutral-700"
              style={{ borderLeft: `3px solid ${toHex(SANCTION_COLORS[row.type])}` }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-neutral-50">{t(`type.${row.type}`)}</p>
                <p className="text-[12.5px] text-neutral-500">
                  <FormattedDate date={row.startsAt} mode="date" />
                </p>
              </div>
              <span className={`flex-none rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${STATUS_STYLES[row.status]}`}>{t(`status.${row.status}`)}</span>
            </Link>
          ))}
        </div>
      )}

      <ListPagination
        page={page}
        totalPages={totalPages}
        prevHref={`/settings/sanctions?page=${page - 1}`}
        nextHref={`/settings/sanctions?page=${page + 1}`}
        previousLabel={t("previous")}
        nextLabel={t("next")}
        pageOfLabel={t("pageOf", { page, total: totalPages })}
      />
    </div>
  );
}
