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
import { ConfirmEmailChangeStatus } from "@/components/settings/confirm-email-change-status";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.email.confirm" });
  return { title: t("title") };
}

export default async function ConfirmEmailChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ userId?: string; email?: string; token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const { userId, email, token } = await searchParams;

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.email.confirm" });

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col items-center px-6 pt-20 pb-28">
      <div className="mb-8 max-w-[420px] text-center">
        <h1 className="mb-2 text-[30px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
      </div>
      <ConfirmEmailChangeStatus userId={userId ?? null} email={email ?? null} token={token ?? null} />
    </div>
  );
}
