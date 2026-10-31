/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/session";
import { isApiAccessBlocked, listPublicApiKeys } from "@/lib/public-api-keys";
import { getPublicApiConfig } from "@/lib/public-api/config";
import { SettingsNav } from "@/components/settings/settings-nav";
import { DISCORD_INVITE_URL } from "@/lib/discord-invite";
import { PublicApiKeysSettings } from "@/components/settings/public-api-keys-settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.publicApi" });
  return { title: t("title") };
}

export default async function ApiSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: "/login", locale: locale as AppLocale });
    return null;
  }

  const [keys, config, blocked] = await Promise.all([listPublicApiKeys(userId), getPublicApiConfig(), isApiAccessBlocked(userId)]);
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.publicApi" });

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-16 pb-28">
      <div className="mb-8">
        <h1 className="mb-2 text-[28px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
        <p className="text-[14.5px] text-neutral-400">{t("subtitle")}</p>
      </div>

      <SettingsNav active="api" />

      <PublicApiKeysSettings keys={keys} blocked={blocked} discordUrl={DISCORD_INVITE_URL} enabled={config.enabled} ratePerSecond={config.ratePerSecond} maxKeys={config.maxKeysPerUser} />
    </div>
  );
}
