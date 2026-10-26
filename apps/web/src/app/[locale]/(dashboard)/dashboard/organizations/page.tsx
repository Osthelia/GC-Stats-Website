/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireDashboardAccess } from "@/lib/dashboard-rbac";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { AdminOrgList } from "@/components/dashboard/admin-org-list";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.picker" });
  return { title: t("allOrganizations") };
}

/** Site admin only: every organization, reachable even when the /dashboard picker is skipped because the admin belongs to a single one. */
export default async function DashboardAllOrganizationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const access = await requireDashboardAccess(locale as AppLocale);
  if (!access.isAuthorAdmin) redirect({ href: "/dashboard", locale: locale as AppLocale });

  const t = await getTranslations({ locale, namespace: "dashboard.picker" });
  const logoUrls = await getCurrentLogoUrlsThemed(
    "organization",
    access.memberships.map((m) => m.organizationId)
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{t("allOrganizations")}</h1>
        <p className="text-sm text-muted-foreground">{t("allOrganizationsSubtitle")}</p>
      </div>
      <AdminOrgList
        organizations={access.memberships.map((m) => ({
          organizationId: m.organizationId,
          organizationName: m.organizationName,
          logoUrl: logoUrls.get(m.organizationId)?.light ?? null,
          darkLogoUrl: logoUrls.get(m.organizationId)?.dark ?? null,
          tags: m.organizationTags,
        }))}
      />
    </div>
  );
}
