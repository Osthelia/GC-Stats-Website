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
import { redirect } from "@/i18n/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getCurrentUserId } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.forgotPassword" });
  return { title: t("title") };
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);

  const userId = await getCurrentUserId();
  if (userId) {
    redirect({ href: "/", locale: locale as AppLocale });
    return null;
  }

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.forgotPassword" });

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col items-center px-6 pt-20 pb-28">
      <div className="mb-8 max-w-[420px] text-center">
        <h1 className="mb-2 text-[30px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
        <p className="text-[15px] leading-[1.6] text-neutral-400">{t("subtitle")}</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
