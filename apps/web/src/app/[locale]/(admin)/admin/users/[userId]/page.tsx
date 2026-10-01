/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import { UserRolesPanel } from "@/components/admin/user-roles-panel";
import { UserAuthMethodsPanel } from "@/components/admin/user-auth-methods-panel";
import { AuthorAccessPanel } from "@/components/admin/author-access-panel";
import { LinkedPlayerPanel } from "@/components/admin/linked-player-panel";
import { UserSanctionsPanel } from "@/components/admin/user-sanctions-panel";
import { UserReportsPanel } from "@/components/admin/user-reports-panel";
import { UserOrganizationsPanel } from "@/components/admin/user-organizations-panel";
import { ForumMessagesPanel } from "@/components/admin/forum-messages-panel";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  getAdminUserProfile,
  getAdminUserAuthMethods,
  getAdminUserLinkedPlayer,
  getAdminUserOrganizations,
  listUserSanctions,
  listUserReportsReceived,
  listUserReportsSubmitted,
} from "@/lib/admin-user-detail";
import { listUserApiKeys } from "@/lib/admin-api-keys";
import { listGlobalRoles } from "@/lib/admin-users";
import { listAdminForumMessages } from "@/lib/admin-forum-messages";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; userId: string }> }): Promise<Metadata> {
  const { locale, userId } = await params;
  const [profile, t] = await Promise.all([getAdminUserProfile(userId), getTranslations({ locale, namespace: "admin.users" })]);
  return { title: profile ? (profile.username ?? t("noUsername")) : t("title") };
}

const MESSAGES_PAGE_SIZE = 10;

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; userId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, userId } = await params;
  const sp = await searchParams;
  const messagesPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.usersView);
  const t = await getTranslations({ locale, namespace: "admin.users" });

  const profile = await getAdminUserProfile(userId);
  if (!profile) notFound();

  const canViewConnections = hasAccess(access, PERMISSIONS.usersViewConnections);
  const canViewPlayer = hasAccess(access, PERMISSIONS.playersView);
  const canViewOrganizations = hasAccess(access, PERMISSIONS.organizationsView);
  const canViewSanctions = hasAccess(access, PERMISSIONS.sanctionsView);
  const canIssueSanction = hasAccess(access, PERMISSIONS.sanctionsManage);
  const canViewReports = hasAccess(access, PERMISSIONS.reportsView);
  const canViewApiKeys = hasAccess(access, PERMISSIONS.apiKeysView);
  const canViewForum = hasAccess(access, PERMISSIONS.forumView);
  const canManageForum = hasAccess(access, PERMISSIONS.forumManage);

  const [authMethods, apiKeys, globalRoles, linkedPlayer, userOrganizations, sanctions, reportsReceived, reportsSubmitted, forumMessages] = await Promise.all([
    canViewConnections ? getAdminUserAuthMethods(userId) : Promise.resolve(null),
    canViewApiKeys ? listUserApiKeys(userId) : Promise.resolve([]),
    listGlobalRoles(),
    canViewPlayer ? getAdminUserLinkedPlayer(userId) : Promise.resolve(null),
    canViewOrganizations ? getAdminUserOrganizations(userId) : Promise.resolve([]),
    canViewSanctions ? listUserSanctions(userId) : Promise.resolve([]),
    canViewReports ? listUserReportsReceived(userId) : Promise.resolve([]),
    canViewReports ? listUserReportsSubmitted(userId) : Promise.resolve([]),
    canViewForum
      ? listAdminForumMessages({ q: "", status: "", sort: "createdAt", direction: "desc", page: messagesPage, userId, pageSize: MESSAGES_PAGE_SIZE })
      : Promise.resolve({ rows: [], total: 0 }),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const canManageUsers = hasAccess(access, PERMISSIONS.usersManage);
  const canManageApiKeys = hasAccess(access, PERMISSIONS.apiKeysManage);
  const messagesTotalPages = Math.max(1, Math.ceil(forumMessages.total / MESSAGES_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToList")}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.image ?? undefined} alt="" />
            <AvatarFallback>{(profile.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">{profile.username ?? t("noUsername")}</h1>
            {canViewConnections && <p className="text-sm text-muted-foreground">{profile.email ?? "—"}</p>}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("joinedOn", { date: dateFmt.format(profile.createdAt) })} · {profile.lastLoginAt ? t("lastLoginOn", { date: dateFmt.format(profile.lastLoginAt) }) : t("neverLoggedIn")}
        </p>
        {profile.bio && (
          <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-muted-foreground">
            <span className="mr-1 font-medium text-foreground">{t("account.bio")}:</span>
            {profile.bio}
          </p>
        )}
        {Object.keys(profile.socials).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {Object.entries(profile.socials).map(([key, url]) => (
              <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground hover:underline">
                {key}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <UserRolesPanel userId={profile.id} currentRoles={profile.roles} allRoles={globalRoles} canManage={access.isSuperAdmin} />
          <AuthorAccessPanel userId={profile.id} isAuthor={profile.isAuthor} canManage={canManageUsers} />
          {canViewPlayer && <LinkedPlayerPanel player={linkedPlayer} />}
          {canViewOrganizations && <UserOrganizationsPanel organizations={userOrganizations} />}
        </div>
        <div className="flex flex-col gap-6">
          {canViewConnections && <UserAuthMethodsPanel userId={profile.id} methods={authMethods!} canManage={canManageUsers} />}
          {canViewSanctions && <UserSanctionsPanel userId={profile.id} username={profile.username} sanctions={sanctions} canIssue={canIssueSanction} />}
        </div>
      </div>

      {canViewReports && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <UserReportsPanel received={reportsReceived} submitted={reportsSubmitted} />
        </div>
      )}

      {canViewApiKeys && <ApiKeysPanel keys={apiKeys} canManage={canManageApiKeys} showUser={false} userId={profile.id} />}

      {canViewForum && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("messagesPanel.title")}</h2>
          <ForumMessagesPanel
            rows={forumMessages.rows}
            canManage={canManageForum}
            canSanction={canIssueSanction}
            sortable={{ pathname: `/admin/users/${profile.id}`, sort: "createdAt", direction: "desc", query: {} }}
          />
          <AdminPagination pathname={`/admin/users/${profile.id}`} page={messagesPage} totalPages={messagesTotalPages} total={forumMessages.total} query={{}} label={`${forumMessages.total}`} />
        </div>
      )}
    </div>
  );
}
