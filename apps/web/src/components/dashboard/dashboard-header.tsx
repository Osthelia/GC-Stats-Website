/**
 * GC-Stats - dashboard-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderAuthStatus } from "@/components/header-auth-status";
import { usePathname } from "@/i18n/navigation";
import { matchDashboardNavItemLabel } from "@/lib/dashboard-nav-items";
import { OrgSwitcher, type DashboardOrgSwitcherItem } from "@/components/dashboard/org-switcher";

export function DashboardHeader({
  organizations,
  isAuthor = false,
  hasApiKey = false,
  isAuthorAdmin = false,
}: {
  organizations: DashboardOrgSwitcherItem[];
  isAuthor?: boolean;
  hasApiKey?: boolean;
  isAuthorAdmin?: boolean;
}) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();

  return (
    <header className="flex h-14 flex-none items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="ml-2 min-w-0 w-1/3 truncate">
        <span className="text-sm font-medium">{t(matchDashboardNavItemLabel(pathname))}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <OrgSwitcher organizations={organizations} isAuthor={isAuthor} hasApiKey={hasApiKey} isAuthorAdmin={isAuthorAdmin} />
        <HeaderAuthStatus isDashboard />
      </div>
    </header>
  );
}
