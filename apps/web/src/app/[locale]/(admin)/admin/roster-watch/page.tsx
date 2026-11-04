/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, HelpCircle, UserPlus } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { RosterWatchAccountsPanel } from "@/components/admin/roster-watch-accounts-panel";
import { RosterWatchDeck } from "@/components/admin/roster-watch-deck";
import { RosterWatchPanel } from "@/components/admin/roster-watch-panel";
import {
  ROSTER_WATCH_PAGE_SIZE,
  ROSTER_WATCH_SORTS,
  ROSTER_WATCH_TABS,
  getRosterWatchTabCounts,
  listMonitoredAccounts,
  listRosterWatchSignals,
  parseTopic,
  type RosterWatchSort,
  type RosterWatchTab,
  type SortDirection,
} from "@/lib/admin-roster-watch";
import { ROSTER_WATCH_PERIODS, TOPICS } from "@/lib/roster-watch/constants";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.rosterWatch" });
  return { title: t("title") };
}

export default async function AdminRosterWatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; status?: string; period?: string; topic?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.rosterWatchView);
  const t = await getTranslations({ locale, namespace: "admin.rosterWatch" });

  const q = (sp.q ?? "").trim().slice(0, 100);
  const tab: RosterWatchTab = (ROSTER_WATCH_TABS as readonly string[]).includes(sp.status ?? "") ? (sp.status as RosterWatchTab) : "roster";
  const sort: RosterWatchSort = (ROSTER_WATCH_SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as RosterWatchSort) : "tweetedAt";
  const direction: SortDirection = sp.direction === "asc" ? "asc" : "desc";
  const period = (ROSTER_WATCH_PERIODS as readonly string[]).includes(sp.period ?? "") ? (sp.period as (typeof ROSTER_WATCH_PERIODS)[number]) : "";
  const topic = parseTopic(sp.topic);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const canManage = hasAccess(access, PERMISSIONS.rosterWatchManage);

  const [{ rows, total }, counts, accounts] = await Promise.all([
    listRosterWatchSignals({ tab, q, period, topic, sort, direction, page }),
    getRosterWatchTabCounts(),
    listMonitoredAccounts(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ROSTER_WATCH_PAGE_SIZE));
  const query = { q, status: tab, period, topic, sort, direction };
  const cleanQuery = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""));
  const cardHref = (value: RosterWatchTab) => ({ pathname: "/admin/roster-watch", query: { ...cleanQuery, status: value } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminStatCard label={t("tabs.roster")} value={counts.roster} icon={UserPlus} color="amber" href={cardHref("roster")} active={tab === "roster"} />
        <AdminStatCard label={t("tabs.unsure")} value={counts.unsure} icon={HelpCircle} color="sky" href={cardHref("unsure")} active={tab === "unsure"} />
        <AdminStatCard label={t("tabs.done")} value={counts.done} icon={CheckCircle2} color="emerald" href={cardHref("done")} active={tab === "done"} />
      </div>

      <AdminSearchSortBar
        searchPlaceholder={t("searchPlaceholder")}
        searchSubmitLabel={t("searchSubmit")}
        searchValue={q}
        sort={sort}
        direction={direction}
        activeWithinValue=""
        activeWithinLabel=""
        activeWithinOptions={[]}
        statusValue={tab}
        statusLabel={t("statusLabel")}
        statusOptions={ROSTER_WATCH_TABS.map((value) => ({ value, label: t(`tabs.${value}`) }))}
        extraFilters={[
          {
            key: "period",
            value: period,
            label: t("filters.period"),
            options: [{ value: "", label: t("filters.periodAny") }, ...ROSTER_WATCH_PERIODS.map((days) => ({ value: days, label: t("filters.periodDays", { days }) }))],
          },
          {
            key: "topic",
            value: topic,
            label: t("filters.topic"),
            options: [{ value: "", label: t("filters.topicAny") }, ...TOPICS.map((value) => ({ value, label: t(`topic.${value}`) }))],
          },
        ]}
      />

      {tab === "done" ? (
        <RosterWatchPanel rows={rows} sortable={{ pathname: "/admin/roster-watch", sort, direction, query }} />
      ) : (
        <RosterWatchDeck rows={rows} canManage={canManage} />
      )}

      <AdminPagination pathname="/admin/roster-watch" page={page} totalPages={totalPages} total={total} query={query} label={`${total}`} />

      <div>
        <h2 className="text-lg font-semibold">{t("accounts.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("accounts.subtitle")}</p>
      </div>
      <RosterWatchAccountsPanel accounts={accounts} canManage={canManage} />
    </div>
  );
}
