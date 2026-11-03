/**
 * GC-Stats — layout
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
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
import { countPendingDiscordImages } from "@/lib/admin-discord-image-reviews";
import { getAdminReportCounts } from "@/lib/admin-reports";
import { getRosterWatchTabCounts } from "@/lib/admin-roster-watch";
import { getAdminModerationSuspectCounts } from "@/lib/admin-moderation-suspects";

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

  const can = (permission: string) => access.isSuperAdmin || access.permissions.has(permission);
  const [changeRequests, discordImages, reports, rosterWatch, moderation] = await Promise.all([
    can(PERMISSIONS.changeRequestsView) ? getAdminChangeRequestCounts().then((counts) => counts.pending > 0) : false,
    can(PERMISSIONS.moderationView) ? countPendingDiscordImages().then((count) => count > 0) : false,
    can(PERMISSIONS.reportsView) ? getAdminReportCounts().then((counts) => counts.pending > 0) : false,
    can(PERMISSIONS.rosterWatchView) ? getRosterWatchTabCounts().then((counts) => counts.roster + counts.unsure > 0) : false,
    can(PERMISSIONS.moderationView) ? getAdminModerationSuspectCounts().then((counts) => counts.pending > 0) : false,
  ]);
  const alerts = {
    "/admin/change-requests": changeRequests,
    "/admin/discord-images": discordImages,
    "/admin/reports": reports,
    "/admin/roster-watch": rosterWatch,
    "/admin/moderation": moderation,
  };

  return (
    <NextIntlClientProvider>
      <SidebarProvider>
        <AdminSidebar
          permissions={[...access.permissions]}
          isSuperAdmin={access.isSuperAdmin}
          alerts={alerts}
        />
        <SidebarInset>
          <AdminHeader />
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </NextIntlClientProvider>
  );
}
