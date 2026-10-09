/**
 * GC-Stats - dashboard-nav-items
 *
 * Sidebar/header nav item definitions for the organization dashboard, with
 * per-item visibility gated by ownership or permission.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ComponentType } from "react";
import { LayoutDashboard, Building2, Users, UsersRound, Clapperboard, KeyRound, KeySquare, Newspaper, UserRound, Radio, Film, ScrollText } from "lucide-react";
import { ORGANIZATION_PERMISSIONS } from "@gc-stats/db";

export type DashboardNavItem = {
  href: (organizationId: number) => string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  /** Hidden unless the viewer is the organization's owner (the role/permission matrix itself — see dashboard-rbac.ts). Every other item is visible to anyone with organization_access, read-only until they have the relevant permission (same pattern as OrgProfileForm/OrgAccessPanel). */
  ownerOnly?: boolean;
  /** Hidden unless the active membership's permission set includes this — unlike ownerOnly, most items have no such gate (readable/writable state is decided per-page instead). */
  permission?: string;
};

// Mirrors admin-nav-items.ts's shape (top item + collapsible groups, shared
// source of truth for the sidebar and header) but every href is a function
// of the active organization id, since /dashboard is scoped per-organization
// rather than site-wide.
/** The org-picker/redirect root (see app/[locale]/(dashboard)/dashboard/page.tsx) — organization switching itself lives in the header (OrgSwitcher), not the sidebar. */
export const DASHBOARD_HOME_HREF = "/dashboard";

export const DASHBOARD_ORG_TOP_ITEMS: DashboardNavItem[] = [{ href: (id) => `/dashboard/${id}`, labelKey: "overview", icon: LayoutDashboard, exact: true }];

export const DASHBOARD_ORG_NAV_GROUPS: { key: string; labelKey: string; items: DashboardNavItem[] }[] = [
  {
    key: "organization",
    labelKey: "groupOrganization",
    items: [
      { href: (id) => `/dashboard/${id}/profile`, labelKey: "profile", icon: Building2 },
      { href: (id) => `/dashboard/${id}/members`, labelKey: "members", icon: UsersRound },
      { href: (id) => `/dashboard/${id}/access`, labelKey: "access", icon: Users },
      { href: (id) => `/dashboard/${id}/permissions`, labelKey: "permissions", icon: KeyRound, ownerOnly: true },
      { href: (id) => `/dashboard/${id}/logs`, labelKey: "logs", icon: ScrollText, permission: ORGANIZATION_PERMISSIONS.logsView },
    ],
  },
  {
    key: "content",
    labelKey: "groupContent",
    items: [
      { href: (id) => `/dashboard/${id}/news`, labelKey: "news", icon: Newspaper, permission: ORGANIZATION_PERMISSIONS.newsView },
      { href: (id) => `/dashboard/${id}/credits`, labelKey: "credits", icon: Clapperboard },
    ],
  },
  {
    key: "broadcast",
    labelKey: "groupBroadcast",
    items: [
      { href: (id) => `/dashboard/${id}/streams`, labelKey: "streams", icon: Radio, permission: ORGANIZATION_PERMISSIONS.streamsView },
      { href: (id) => `/dashboard/${id}/vods`, labelKey: "vods", icon: Film, permission: ORGANIZATION_PERMISSIONS.vodsLink },
    ],
  },
  {
    key: "developer",
    labelKey: "groupDeveloper",
    items: [{ href: (id) => `/dashboard/${id}/api-keys`, labelKey: "apiKeys", icon: KeySquare, permission: ORGANIZATION_PERMISSIONS.apiKeysManage }],
  },
];

/** Flattened, in registration order — used by matchDashboardNavItemLabel and anywhere else that just needs "every item" regardless of grouping. */
export const DASHBOARD_ORG_NAV_ITEMS: DashboardNavItem[] = [...DASHBOARD_ORG_TOP_ITEMS, ...DASHBOARD_ORG_NAV_GROUPS.flatMap((g) => g.items)];

/** The individual authoring space (/dashboard/author) — not organization-scoped, gated by users.is_author instead (see dashboard-rbac.ts requireAuthorAccess). */
export const DASHBOARD_AUTHOR_NAV_ITEMS: { href: string; labelKey: string; icon: ComponentType<{ className?: string }>; exact?: boolean }[] = [
  { href: "/dashboard/author", labelKey: "myArticles", icon: Newspaper, exact: true },
  { href: "/dashboard/author/profile", labelKey: "authorProfile", icon: UserRound },
];

/** The admin view over every author (/dashboard/authors), only for a site admin holding the global override (see dashboard-rbac.ts requireAuthorAdminAccess). */
export const DASHBOARD_AUTHOR_ADMIN_HREF = "/dashboard/authors";
export const DASHBOARD_AUTHOR_ADMIN_NAV_ITEMS: { href: string; labelKey: string; icon: ComponentType<{ className?: string }>; exact?: boolean }[] = [
  { href: DASHBOARD_AUTHOR_ADMIN_HREF, labelKey: "allAuthors", icon: UsersRound },
];

/** Segment-aware match, since "/dashboard/authors" would otherwise also satisfy a plain startsWith("/dashboard/author"). */
export function isDashboardPathIn(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** The individual API key space (/dashboard/api-keys) — not organization-scoped, gated by owning a personal api_key row instead (see dashboard-rbac.ts requireApiKeyAccess). Same idea as DASHBOARD_AUTHOR_NAV_ITEMS. */
export const DASHBOARD_API_KEY_NAV_ITEMS: { href: string; labelKey: string; icon: ComponentType<{ className?: string }>; exact?: boolean }[] = [
  { href: "/dashboard/api-keys", labelKey: "myApiKeys", icon: KeySquare, exact: true },
];

/** Resolves any /dashboard/{id}/*, /dashboard/author/* or /dashboard/api-keys/* pathname to its nav item's labelKey, mirroring matchAdminNavItem — used by dashboard-header.tsx to name the current page. */
export function matchDashboardNavItemLabel(pathname: string): string {
  if (pathname === DASHBOARD_HOME_HREF) return "overview";
  if (isDashboardPathIn(pathname, DASHBOARD_AUTHOR_ADMIN_HREF)) return "allAuthors";
  if (isDashboardPathIn(pathname, "/dashboard/author")) {
    const authorItem = DASHBOARD_AUTHOR_NAV_ITEMS.find((i) => pathname === i.href);
    return authorItem?.labelKey ?? "myArticles";
  }
  if (isDashboardPathIn(pathname, "/dashboard/api-keys")) return "myApiKeys";
  const suffix = pathname.replace(/^\/dashboard\/\d+/, "");
  const item = DASHBOARD_ORG_NAV_ITEMS.find((i) => suffix === i.href(0).replace(/^\/dashboard\/0/, ""));
  return item?.labelKey ?? "overview";
}
