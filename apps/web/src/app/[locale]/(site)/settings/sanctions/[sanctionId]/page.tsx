/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getOwnSanctionDetail } from "@/lib/settings-sanctions";
import { SANCTION_COLORS } from "@/lib/sanction-constants";
import { FormattedDate } from "@/components/formatted-date";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.sanctions" });
  return { title: t("title") };
}

function toHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export default async function MySanctionDetailPage({ params }: { params: Promise<{ locale: string; sanctionId: string }> }) {
  const { locale, sanctionId } = await params;
  setRequestLocale(locale as AppLocale);
  const id = Number.parseInt(sanctionId, 10);
  if (!Number.isFinite(id)) notFound();

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: "/login", locale: locale as AppLocale });
    return null;
  }

  const detail = await getOwnSanctionDetail(userId, id);
  if (!detail) notFound();

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.sanctions" });

  return (
    <div className="mx-auto max-w-[700px] px-6 pt-16 pb-28">
      <Link href="/settings/sanctions" className="text-[13px] text-neutral-500 hover:text-neutral-200">
        {t("detail.backToList")}
      </Link>

      <div className="mt-4 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] p-6" style={{ borderLeft: `3px solid ${toHex(SANCTION_COLORS[detail.type])}` }}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h1 className="text-[22px] font-bold tracking-tight text-neutral-50">{t(`type.${detail.type}`)}</h1>
          <span className="flex-none text-[12.5px] font-semibold text-neutral-400">{t(`status.${detail.status}`)}</span>
        </div>

        <p className="mb-6 text-[14px] leading-[1.6] text-neutral-300">{detail.reason}</p>

        <dl className="flex flex-col gap-2 border-t border-neutral-800 pt-4 text-[13px]">
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">{t("detail.startsAt")}</dt>
            <dd className="text-neutral-200">
              <FormattedDate date={detail.startsAt} mode="datetime" />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">{t("detail.endsAt")}</dt>
            <dd className="text-neutral-200">{detail.endsAt ? <FormattedDate date={detail.endsAt} mode="datetime" /> : t("permanent")}</dd>
          </div>
          {detail.revokedAt && (
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">{t("detail.revokedAt")}</dt>
              <dd className="text-neutral-200">
                <FormattedDate date={detail.revokedAt} mode="datetime" />
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
