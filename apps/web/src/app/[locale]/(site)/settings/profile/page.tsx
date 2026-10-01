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
import { getCurrentUserId } from "@/lib/session";
import { getMyProfile } from "@/actions/user-profile";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.profile" });
  return { title: t("heading") };
}

export default async function ProfileSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: "/login", locale: locale as AppLocale });
    return null;
  }

  const profile = await getMyProfile();
  const t = await getTranslations("accountSettings");

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-16 pb-28">
      <div className="mb-8">
        <h1 className="mb-2 text-[28px] font-bold tracking-tight text-neutral-50">{t("profile.heading")}</h1>
        <p className="text-[14.5px] text-neutral-400">{t("profile.description")}</p>
      </div>

      <SettingsNav active="profile" />

      <ProfileSettingsForm profile={profile} />
    </div>
  );
}
