/**
 * GC-Stats — permissions module
 *
 * Admin permission catalog: source of truth for both the seed script
 * (packages/db/scripts/seed-admin-permissions.ts, which inserts these rows
 * into `permissions`) and the /admin/roles permission editor, which must
 * reject any name outside this list. Deliberately scoped to sections that
 * actually exist in /admin today; add a permission here the same day its
 * page/action starts checking it, not ahead of time.
 *
 * Role/permission management itself (the /admin/roles page) is NOT a
 * permission here and never will be: it's gated by `isSuperAdmin` alone
 * (see apps/web/src/lib/rbac.ts), so no role can grant itself, or any other
 * role, more access than it already has. Mirrors V1's super-admin-only
 * 'manage-roles' gate.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const PERMISSIONS = {
  adminAccess: "admin.access",
  usersView: "users.view",
  usersViewConnections: "users.view-connections",
  usersManage: "users.manage",
  teamsView: "teams.view",
  teamsCreate: "teams.create",
  teamsEdit: "teams.edit",
  teamsDelete: "teams.delete",
  teamsMerge: "teams.merge",
  playersView: "players.view",
  playersCreate: "players.create",
  playersEdit: "players.edit",
  playersDelete: "players.delete",
  playersMerge: "players.merge",
  financeView: "finance.view",
  financeManage: "finance.manage",
  aboutView: "about.view",
  aboutManage: "about.manage",
  apiKeysView: "api-keys.view",
  apiKeysManage: "api-keys.manage",
  emotesView: "emotes.view",
  emotesManage: "emotes.manage",
  pointTypesView: "point-types.view",
  pointTypesManage: "point-types.manage",
  newsLanguagesView: "news-languages.view",
  newsLanguagesManage: "news-languages.manage",
  organizationsView: "organizations.view",
  organizationsEdit: "organizations.edit",
  organizationsManageAccess: "organizations.manage-access",
  organizationsDelete: "organizations.delete",
  changeRequestsView: "change-requests.view",
  changeRequestsManage: "change-requests.manage",
  tournamentsView: "tournaments.view",
  tournamentsManage: "tournaments.manage",
  reportsView: "reports.view",
  reportsManage: "reports.manage",
  moderationView: "moderation.view",
  moderationManage: "moderation.manage",
  forumView: "forum.view",
  forumManage: "forum.manage",
  sanctionsView: "sanctions.view",
  sanctionsManage: "sanctions.manage",
  activityLogView: "activity-log.view",
  analyticsView: "analytics.view",
  oauthClientsView: "oauth-clients.view",
  oauthClientsManage: "oauth-clients.manage",
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_GROUPS: { key: string; permissions: PermissionName[] }[] = [
  { key: "core", permissions: [PERMISSIONS.adminAccess] },
  { key: "users", permissions: [PERMISSIONS.usersView, PERMISSIONS.usersViewConnections, PERMISSIONS.usersManage] },
  { key: "teams", permissions: [PERMISSIONS.teamsView, PERMISSIONS.teamsCreate, PERMISSIONS.teamsEdit, PERMISSIONS.teamsDelete, PERMISSIONS.teamsMerge] },
  {
    key: "players",
    permissions: [PERMISSIONS.playersView, PERMISSIONS.playersCreate, PERMISSIONS.playersEdit, PERMISSIONS.playersDelete, PERMISSIONS.playersMerge],
  },
  { key: "finance", permissions: [PERMISSIONS.financeView, PERMISSIONS.financeManage] },
  { key: "about", permissions: [PERMISSIONS.aboutView, PERMISSIONS.aboutManage] },
  { key: "apiKeys", permissions: [PERMISSIONS.apiKeysView, PERMISSIONS.apiKeysManage] },
  { key: "emotes", permissions: [PERMISSIONS.emotesView, PERMISSIONS.emotesManage] },
  { key: "pointTypes", permissions: [PERMISSIONS.pointTypesView, PERMISSIONS.pointTypesManage] },
  { key: "newsLanguages", permissions: [PERMISSIONS.newsLanguagesView, PERMISSIONS.newsLanguagesManage] },
  {
    key: "organizations",
    permissions: [PERMISSIONS.organizationsView, PERMISSIONS.organizationsEdit, PERMISSIONS.organizationsManageAccess, PERMISSIONS.organizationsDelete],
  },
  { key: "changeRequests", permissions: [PERMISSIONS.changeRequestsView, PERMISSIONS.changeRequestsManage] },
  { key: "tournaments", permissions: [PERMISSIONS.tournamentsView, PERMISSIONS.tournamentsManage] },
  { key: "reports", permissions: [PERMISSIONS.reportsView, PERMISSIONS.reportsManage] },
  { key: "moderation", permissions: [PERMISSIONS.moderationView, PERMISSIONS.moderationManage] },
  { key: "forum", permissions: [PERMISSIONS.forumView, PERMISSIONS.forumManage] },
  { key: "sanctions", permissions: [PERMISSIONS.sanctionsView, PERMISSIONS.sanctionsManage] },
  { key: "activityLog", permissions: [PERMISSIONS.activityLogView] },
  { key: "analytics", permissions: [PERMISSIONS.analyticsView] },
  { key: "oauthClients", permissions: [PERMISSIONS.oauthClientsView, PERMISSIONS.oauthClientsManage] },
];

export const ALL_PERMISSIONS: PermissionName[] = PERMISSION_GROUPS.flatMap((g) => g.permissions);
