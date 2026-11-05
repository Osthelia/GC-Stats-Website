/**
 * GC-Stats — layout
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { GAMES } from "@gc-stats/db/game";
import { PERMISSIONS } from "@gc-stats/db";
import { getGlobalAccess, requireAdminAccess } from "@/lib/rbac";
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
  // The sidebar shows a section when any game grants it, each page then checks the permission for its own game.
  const perGame = await Promise.all(GAMES.map((game) => getGlobalAccess(access.userId, game)));
  const permissions = new Set([...access.permissions, ...perGame.flatMap((a) => [...a.permissions])]);
  const isSuperAdmin = access.isSuperAdmin || perGame.some((a) => a.isSuperAdmin);

  const pendingPerGame = await Promise.all(
    GAMES.map(async (game, i) => {
      const gameAccess = perGame[i]!;
      const canSee = access.isSuperAdmin || gameAccess.isSuperAdmin || access.permissions.has(PERMISSIONS.changeRequestsView) || gameAccess.permissions.has(PERMISSIONS.changeRequestsView);
      return canSee && (await getAdminChangeRequestCounts(game)).pending > 0;
    })
  );
  const hasPendingChangeRequests = pendingPerGame.some(Boolean);

  return (
    <NextIntlClientProvider>
      <SidebarProvider>
        <AdminSidebar
          permissions={[...permissions]}
          isSuperAdmin={isSuperAdmin}
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
