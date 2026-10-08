/**
 * GC-Stats — layout
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { requireDashboardAccess } from "@/lib/dashboard-rbac";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import type { AppLocale } from "@/i18n/routing";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardRefreshOnFocus } from "@/components/dashboard/dashboard-refresh-on-focus";

// Overrides the root layout's "%s | GC-Stats" template for everything under
// /dashboard, same pattern as (admin)/admin/layout.tsx.
export const metadata: Metadata = {
  title: { template: "%s | GC Stats", default: "Dashboard | GC Stats" },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const access = await requireDashboardAccess(locale as AppLocale);

  const logoUrls = await getCurrentLogoUrlsThemed(
    "organization",
    access.memberships.map((m) => m.organizationId)
  );

  // Sets aren't RSC-serializable across the server/client boundary, so
  // DashboardSidebar (a client component) gets plain arrays instead.
  const organizations = access.memberships.map((m) => ({
    organizationId: m.organizationId,
    organizationName: m.organizationName,
    roleName: m.roleName,
    isOwner: m.isOwner,
    permissions: [...m.permissions],
    isGlobalAdminOverride: m.isGlobalAdminOverride ?? false,
  }));

  const switcherOrganizations = access.memberships.map((m) => ({
    organizationId: m.organizationId,
    organizationName: m.organizationName,
    logoUrl: logoUrls.get(m.organizationId)?.light ?? null,
    darkLogoUrl: logoUrls.get(m.organizationId)?.dark ?? null,
    isGlobalAdminOverride: m.isGlobalAdminOverride ?? false,
  }));

  return (
    <NextIntlClientProvider>
      <SidebarProvider>
        <DashboardRefreshOnFocus />
        <DashboardSidebar organizations={organizations} />
        <SidebarInset>
          <DashboardHeader organizations={switcherOrganizations} isAuthor={access.isAuthor} hasApiKey={access.hasApiKey} isAuthorAdmin={access.isAuthorAdmin} />
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </NextIntlClientProvider>
  );
}
