/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { Newspaper, KeySquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireDashboardAccess } from "@/lib/dashboard-rbac";
import { getCurrentLogoUrls } from "@/lib/admin-logos";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.picker" });
  return { title: t("title") };
}

/**
 * Landing spot with no organization selected yet: a single organization
 * skips straight to it, several show a simple picker (no dashboard "home"
 * page otherwise).
 */
export default async function DashboardHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const access = await requireDashboardAccess(locale as AppLocale);

  const ownMemberships = access.memberships.filter((m) => !m.isGlobalAdminOverride);
  const adminMemberships = access.memberships.filter((m) => m.isGlobalAdminOverride);

  // Only auto-skip the picker when there's a single destination overall
  // (one organization, or one of the individual spaces alone) — with
  // several, the picker stays so every space stays reachable instead of
  // always bouncing straight past it. The global admin override is never
  // counted here: an admin with no organization of their own but the
  // override still lands on the picker, to browse every organization.
  const destinationCount = ownMemberships.length + (access.isAuthor ? 1 : 0) + (access.hasApiKey ? 1 : 0);
  if (destinationCount === 1) {
    if (ownMemberships.length === 1) redirect({ href: `/dashboard/${ownMemberships[0]!.organizationId}`, locale: locale as AppLocale });
    if (access.isAuthor) redirect({ href: "/dashboard/author", locale: locale as AppLocale });
    redirect({ href: "/dashboard/api-keys", locale: locale as AppLocale });
  }

  const t = await getTranslations({ locale, namespace: "dashboard.picker" });
  const logoUrls = await getCurrentLogoUrls(
    "organization",
    access.memberships.map((m) => m.organizationId)
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {access.isAuthor && (
            <Link
              href="/dashboard/author"
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex size-10 flex-none items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Newspaper className="size-5" />
              </span>
              <span className="min-w-0 truncate font-medium">{t("authorSpace")}</span>
            </Link>
          )}
          {access.hasApiKey && (
            <Link
              href="/dashboard/api-keys"
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex size-10 flex-none items-center justify-center rounded-md bg-muted text-muted-foreground">
                <KeySquare className="size-5" />
              </span>
              <span className="min-w-0 truncate font-medium">{t("apiKeySpace")}</span>
            </Link>
          )}
          {ownMemberships.map((m) => (
            <Link
              key={m.organizationId}
              href={`/dashboard/${m.organizationId}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <OrgLogoTile name={m.organizationName} logoUrl={logoUrls.get(m.organizationId) ?? null} className="size-10" />
              <span className="min-w-0 truncate font-medium">{m.organizationName}</span>
            </Link>
          ))}
        </div>
      </div>

      {adminMemberships.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("allOrganizations")}</h2>
            <p className="text-sm text-muted-foreground">{t("allOrganizationsSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {adminMemberships.map((m) => (
              <Link
                key={m.organizationId}
                href={`/dashboard/${m.organizationId}`}
                className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <OrgLogoTile name={m.organizationName} logoUrl={logoUrls.get(m.organizationId) ?? null} className="size-10" />
                <span className="min-w-0 flex-1 truncate font-medium">{m.organizationName}</span>
                <span className="flex-none rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">{t("adminBadge")}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
