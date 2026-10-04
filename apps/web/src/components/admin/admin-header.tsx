/**
 * GC-Stats - admin-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { HeaderAuthStatus } from "@/components/header-auth-status";
import { AdminTimezoneSelect } from "@/components/admin/admin-timezone-select";
import { usePathname } from "@/i18n/navigation";
import { matchAdminNavItem } from "@/lib/admin-nav-items";

export function AdminHeader() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const current = matchAdminNavItem(pathname);

  return (
    <header className="flex h-14 flex-none items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="w-1/3 min-w-0 truncate ml-2">
        <span className="text-sm font-medium">{current ? t(current.labelKey) : t("dashboard")}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <AdminTimezoneSelect />
        <HeaderAuthStatus isAdmin />
      </div>
    </header>
  );
}
