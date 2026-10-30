/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { OpenDataSettingsForm } from "@/components/admin/opendata-settings-form";
import { hasAccess, requireAdminPermission } from "@/lib/rbac";
import { readOpenDataConfig } from "@/lib/opendata/config";
import { PublicApiSettingsForm } from "@/components/admin/public-api-settings-form";
import { readPublicApiConfig } from "@/lib/public-api/config";
import type { AppLocale } from "@/i18n/routing";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.settings" });
  return { title: t("title") };
}
export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.settingsView);
  const t = await getTranslations({ locale, namespace: "admin.settings" });
  const [config, publicApiConfig] = await Promise.all([readOpenDataConfig(), readPublicApiConfig()]);
  const canManage = hasAccess(access, PERMISSIONS.settingsManage);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <OpenDataSettingsForm initialConfig={config} canManage={canManage} />
      <PublicApiSettingsForm initialConfig={publicApiConfig} canManage={canManage} />
    </div>
  );
}
