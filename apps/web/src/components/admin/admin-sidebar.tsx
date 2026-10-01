/**
 * GC-Stats - admin-sidebar
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
import { ADMIN_TOP_ITEMS as TOP_ITEMS, ADMIN_NAV_GROUPS as NAV_GROUPS, type AdminNavItem as NavItem } from "@/lib/admin-nav-items";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const STORAGE_PREFIX = "gcs_admin_nav_";

function NavGroup({
  groupKey,
  label,
  children,
}: {
  groupKey: string;
  label: string;
  children: React.ReactNode;
}) {
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
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-linear",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          "group-data-[collapsible=icon]:grid-rows-[1fr]"
        )}
      >
        <div className="overflow-hidden">
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </div>
      </div>
    </SidebarGroup>
  );
}

export function AdminSidebar({ permissions, isSuperAdmin }: { permissions: string[]; isSuperAdmin: boolean }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const canSee = (item: NavItem) =>
    isSuperAdmin || ((!item.superAdminOnly) && (!item.permission || permissions.includes(item.permission)));

  const visibleGroups = NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(canSee) })).filter(
    (group) => group.items.length > 0
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[#e4ae22] text-[12px] font-bold text-[#0e0e0e]">
            GC
          </div>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">Admin</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-3">
        <SidebarGroup className="pb-3">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {TOP_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item)}
                    tooltip={t(item.labelKey)}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="size-3.5" />
                    <span>{t(item.labelKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
          <SidebarSeparator className="mt-3 mb-0 group-data-[collapsible=icon]:hidden" />
        </SidebarGroup>

        {visibleGroups.map((group) => (
          <NavGroup key={group.key} groupKey={group.key} label={t(group.labelKey)}>
            <SidebarMenu className="gap-1.5">
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item)}
                    tooltip={t(item.labelKey)}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="size-3.5" />
                    <span>{t(item.labelKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </NavGroup>
        ))}
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
