/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Hourglass, Sparkles } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { TeamRequestsRecommended } from "@/components/admin/team-requests-recommended";
import { TeamRequestsTable } from "@/components/admin/team-requests-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getTeamRequestCounts, listRecommendedTeams, listTeamRequests } from "@/lib/admin-team-requests";
import { TEAM_REQUEST_PAGE_SIZE, TEAM_REQUEST_SCOPES, TEAM_REQUEST_TABS, type TeamRequestScope, type TeamRequestTab } from "@/lib/team-requests/constants";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.teamRequests" });
  return { title: t("title") };
}

export default async function AdminTeamRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; scope?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.teamRequestsView);
  const t = await getTranslations({ locale, namespace: "admin.teamRequests" });

  const tab: TeamRequestTab = (TEAM_REQUEST_TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as TeamRequestTab) : "recommended";
  const scope: TeamRequestScope = (TEAM_REQUEST_SCOPES as readonly string[]).includes(sp.scope ?? "") ? (sp.scope as TeamRequestScope) : "mine";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const canManage = hasAccess(access, PERMISSIONS.teamRequestsManage);

  const counts = await getTeamRequestCounts(access.userId, scope);
  const tabHref = (value: TeamRequestTab) => ({ pathname: "/admin/team-requests", query: { tab: value, scope } });

  const query = { tab, scope };
  const requests = tab === "recommended" ? null : await listTeamRequests({ tab, scope, userId: access.userId, page });
  const recommended = tab === "recommended" ? await listRecommendedTeams() : [];
  const totalPages = requests ? Math.max(1, Math.ceil(requests.total / TEAM_REQUEST_PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminStatCard label={t("tabs.recommended")} value={counts.recommended} icon={Sparkles} color="violet" href={tabHref("recommended")} active={tab === "recommended"} />
        <AdminStatCard label={t("tabs.pending")} value={counts.pending} icon={Hourglass} color="amber" href={tabHref("pending")} active={tab === "pending"} />
        <AdminStatCard label={t("tabs.done")} value={counts.done} icon={CheckCircle2} color="emerald" href={tabHref("done")} active={tab === "done"} />
      </div>

      {tab !== "recommended" && (
        <div className="flex items-center gap-2" role="group" aria-label={t("scopeLabel")}>
          {TEAM_REQUEST_SCOPES.map((value) => (
            <Button
              key={value}
              variant={scope === value ? "default" : "outline"}
              size="sm"
              aria-pressed={scope === value}
              className="active:scale-95"
              render={<Link href={{ pathname: "/admin/team-requests", query: { tab, scope: value } }} />}
            >
              {t(`scope.${value}`)}
            </Button>
          ))}
        </div>
      )}

      {requests ? (
        <>
          <TeamRequestsTable rows={requests.rows} canManage={canManage} />
          <AdminPagination pathname="/admin/team-requests" page={page} totalPages={totalPages} total={requests.total} query={query} label={`${requests.total}`} />
        </>
      ) : (
        <TeamRequestsRecommended rows={recommended} canManage={canManage} />
      )}
    </div>
  );
}
