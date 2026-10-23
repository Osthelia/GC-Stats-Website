/**
 * GC-Stats — layout
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { PERMISSIONS } from "@gc-stats/db";
import { requireAdminAccess } from "@/lib/rbac";
import { getAdminChangeRequestCounts } from "@/lib/admin-change-requests";
import type { AppLocale } from "@/i18n/routing";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

// Overrides the root layout's "%s — GC-Stats" template for everything under
// /admin — every admin page sets its own short `title` (via generateMetadata
// on that page), resolved into "PageName | GC Stats" here.
export const metadata: Metadata = {
  title: { template: "%s | GC Stats", default: "Admin | GC Stats" },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const access = await requireAdminAccess(locale as AppLocale);

  const canSeeChangeRequests = access.isSuperAdmin || access.permissions.has(PERMISSIONS.changeRequestsView);
  const hasPendingChangeRequests = canSeeChangeRequests && (await getAdminChangeRequestCounts()).pending > 0;

  return (
    <NextIntlClientProvider>
      <SidebarProvider>
        <AdminSidebar
          permissions={[...access.permissions]}
          isSuperAdmin={access.isSuperAdmin}
          hasPendingChangeRequests={hasPendingChangeRequests}
        />
        <SidebarInset>
          <AdminHeader />
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </NextIntlClientProvider>
  );
}
