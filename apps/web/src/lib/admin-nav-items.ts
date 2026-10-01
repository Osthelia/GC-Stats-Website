/**
 * GC-Stats - admin-nav-items
 *
 * Single source of truth for the /admin navigation: sections, permission
 * gating, and pathname to nav item matching, shared by the sidebar and
 * header.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  Shield,
  User,
  KeyRound,
  Landmark,
  Info,
  KeySquare,
  Smile,
  Trophy,
  Building2,
  FileEdit,
  Swords,
  Languages,
  Flag,
  ShieldAlert,
  MessagesSquare,
  Ban,
  History,
  LineChart,
  Plug,
} from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";

export type AdminNavItem = {
  href: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  exact: boolean;
  /** Item hidden unless the viewer has this permission — omitted means "always visible to anyone with admin.access". */
  permission?: string;
  /** Item hidden unless the viewer is a super admin (role/permission management — see packages/db/src/permissions.ts). */
  superAdminOnly?: boolean;
};

// Shared between the sidebar (admin-sidebar.tsx, which also needs icons/
// grouping/permission gating) and the header (admin-header.tsx, which only
// needs href -> labelKey to name the current page) — single source of truth
// for the admin section list, evite de dupliquer les memes donnees dans
// deux composants.
export const ADMIN_TOP_ITEMS: AdminNavItem[] = [{ href: "/admin", labelKey: "dashboard", icon: LayoutDashboard, exact: true }];

export const ADMIN_NAV_GROUPS: { key: string; labelKey: string; items: AdminNavItem[] }[] = [
  {
    key: "content",
    labelKey: "groupContent",
    items: [
      { href: "/admin/tournaments", labelKey: "tournaments", icon: Swords, exact: false, permission: PERMISSIONS.tournamentsView },
      { href: "/admin/organizations", labelKey: "organizations", icon: Building2, exact: false, permission: PERMISSIONS.organizationsView },
      { href: "/admin/teams", labelKey: "teams", icon: Shield, exact: false, permission: PERMISSIONS.teamsView },
      { href: "/admin/players", labelKey: "players", icon: User, exact: false, permission: PERMISSIONS.playersView },
      { href: "/admin/point-types", labelKey: "pointTypes", icon: Trophy, exact: false, permission: PERMISSIONS.pointTypesView },
      { href: "/admin/change-requests", labelKey: "changeRequests", icon: FileEdit, exact: false, permission: PERMISSIONS.changeRequestsView },
    ],
  },
  {
    key: "moderation",
    labelKey: "groupModeration",
    items: [
      { href: "/admin/reports", labelKey: "reports", icon: Flag, exact: false, permission: PERMISSIONS.reportsView },
      { href: "/admin/moderation", labelKey: "moderationAuto", icon: ShieldAlert, exact: false, permission: PERMISSIONS.moderationView },
      { href: "/admin/forum", labelKey: "forumMessages", icon: MessagesSquare, exact: false, permission: PERMISSIONS.forumView },
      { href: "/admin/sanctions", labelKey: "sanctions", icon: Ban, exact: false, permission: PERMISSIONS.sanctionsView },
    ],
  },
  {
    key: "admin",
    labelKey: "groupAdmin",
    items: [
      { href: "/admin/users", labelKey: "users", icon: Users, exact: false, permission: PERMISSIONS.usersView },
      { href: "/admin/roles", labelKey: "roles", icon: KeyRound, exact: false, superAdminOnly: true },
      { href: "/admin/api-keys", labelKey: "apiKeys", icon: KeySquare, exact: false, permission: PERMISSIONS.apiKeysView },
      { href: "/admin/oauth-clients", labelKey: "oauthClients", icon: Plug, exact: false, permission: PERMISSIONS.oauthClientsView },
      { href: "/admin/emotes", labelKey: "emotes", icon: Smile, exact: false, permission: PERMISSIONS.emotesView },
      { href: "/admin/news-languages", labelKey: "newsLanguages", icon: Languages, exact: false, permission: PERMISSIONS.newsLanguagesView },
      { href: "/admin/finance", labelKey: "finance", icon: Landmark, exact: false, permission: PERMISSIONS.financeView },
      { href: "/admin/about", labelKey: "about", icon: Info, exact: false, permission: PERMISSIONS.aboutView },
      { href: "/admin/analytics", labelKey: "analytics", icon: LineChart, exact: false, permission: PERMISSIONS.analyticsView },
      { href: "/admin/activity-log", labelKey: "activityLog", icon: History, exact: false, permission: PERMISSIONS.activityLogView },
    ],
  },
];

/** Flattened, in registration order — longest `href` first so a prefix match (e.g. a team detail page under /admin/teams/[id]) resolves to the most specific section rather than a shorter unrelated prefix. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [...ADMIN_TOP_ITEMS, ...ADMIN_NAV_GROUPS.flatMap((g) => g.items)].sort((a, b) => b.href.length - a.href.length);

/** Resolves any /admin/* pathname (including entity detail pages not themselves in the nav, e.g. /admin/teams/42) to the nav item for its section. */
export function matchAdminNavItem(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)));
}
