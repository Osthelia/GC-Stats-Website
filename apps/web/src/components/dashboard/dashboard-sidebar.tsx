/**
 * GC-Stats - dashboard-sidebar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DASHBOARD_ORG_TOP_ITEMS, DASHBOARD_ORG_NAV_GROUPS, DASHBOARD_AUTHOR_NAV_ITEMS, DASHBOARD_API_KEY_NAV_ITEMS, type DashboardNavItem } from "@/lib/dashboard-nav-items";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export type DashboardOrgSummary = {
  organizationId: number;
  organizationName: string;
  roleName: string;
  isOwner: boolean;
  permissions: string[];
  isGlobalAdminOverride: boolean;
};

const STORAGE_PREFIX = "gcs_dashboard_nav_";

/** Mirrors components/admin/admin-sidebar.tsx's NavGroup (kept separate, admin and dashboard never share components), collapsible, state persisted per group. */
function NavGroup({ groupKey, label, children }: { groupKey: string; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const storageKey = `${STORAGE_PREFIX}${groupKey}`;

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) setOpen(stored !== "0");
  }, [storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  };

  return (
    <SidebarGroup className="gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 outline-hidden transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
      >
        <span>{label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-200", !open && "-rotate-90")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-linear", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]", "group-data-[collapsible=icon]:grid-rows-[1fr]")}>
        <div className="overflow-hidden">
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </div>
      </div>
    </SidebarGroup>
  );
}

/** Same visual identity as /admin, no wrapper theme class, just the shared shadcn tokens. Cross-organization switching now lives in the header (OrgSwitcher), so this sidebar only ever shows the active organization's own nav. */
export function DashboardSidebar({ organizations }: { organizations: DashboardOrgSummary[] }) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();

  const isAuthorSpace = pathname.startsWith("/dashboard/author");
  const isApiKeySpace = pathname.startsWith("/dashboard/api-keys");
  const orgMatch = /^\/dashboard\/(\d+)/.exec(pathname);
  const activeOrgId = orgMatch ? Number(orgMatch[1]) : null;
  const activeOrg = organizations.find((o) => o.organizationId === activeOrgId) ?? null;

  const canSee = (item: DashboardNavItem) => !!activeOrg && (!item.ownerOnly || activeOrg.isOwner) && (!item.permission || activeOrg.permissions.includes(item.permission));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const visibleGroups = activeOrg ? DASHBOARD_ORG_NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(canSee) })).filter((group) => group.items.length > 0) : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[#e4ae22] text-[12px] font-bold text-[#0e0e0e]">GC</div>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">{t("brand")}</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-3">
        {isAuthorSpace || isApiKeySpace ? (
          <SidebarGroup className="gap-1">
            <SidebarGroupLabel className="truncate">{t(isAuthorSpace ? "authorSpace" : "apiKeySpace")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {(isAuthorSpace ? DASHBOARD_AUTHOR_NAV_ITEMS : DASHBOARD_API_KEY_NAV_ITEMS).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={item.exact ? pathname === item.href : isActive(item.href)} tooltip={t(item.labelKey)} render={<Link href={item.href} />}>
                      <item.icon className="size-3.5" />
                      <span>{t(item.labelKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : activeOrg ? (
          <>
            <SidebarGroup className="gap-1 pb-3">
              <SidebarGroupLabel className="flex items-center gap-1.5 truncate">
                <span className="truncate">{activeOrg.organizationName}</span>
                {activeOrg.isGlobalAdminOverride && (
                  <span className="flex-none rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-600 dark:text-amber-400 group-data-[collapsible=icon]:hidden">
                    {t("adminAccess")}
                  </span>
                )}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {DASHBOARD_ORG_TOP_ITEMS.map((item) => {
                    const href = item.href(activeOrg.organizationId);
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton isActive={item.exact ? pathname === href : isActive(href)} tooltip={t(item.labelKey)} render={<Link href={href} />}>
                          <item.icon className="size-3.5" />
                          <span>{t(item.labelKey)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
              <SidebarSeparator className="mt-3 mb-0 group-data-[collapsible=icon]:hidden" />
            </SidebarGroup>

            {visibleGroups.map((group) => (
              <NavGroup key={group.key} groupKey={group.key} label={t(group.labelKey)}>
                <SidebarMenu className="gap-1.5">
                  {group.items.map((item) => {
                    const href = item.href(activeOrg.organizationId);
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton isActive={isActive(href)} tooltip={t(item.labelKey)} render={<Link href={href} />}>
                          <item.icon className="size-3.5" />
                          <span>{t(item.labelKey)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </NavGroup>
            ))}
          </>
        ) : (
          <p className="px-4 py-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">{t("noOrganizationSelected")}</p>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t("backToSite")} render={<Link href="/" />}>
              <ArrowLeft />
              <span>{t("backToSite")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
