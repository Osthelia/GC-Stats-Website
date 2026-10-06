/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getTeamPageInfo, getTeamRoster, getTeamNameHistory } from "@/lib/team-page-data";
import { TeamRoster } from "@/components/team/team-roster";
import { TeamFormerMembers } from "@/components/team/team-former-members";
import { ListPagination } from "@/components/filters/list-pagination";
import { displayMonthYear } from "@/lib/daterange";
import type { Metadata } from "next";
import { teamPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; teamId: string }> }): Promise<Metadata> {
  const { locale, teamId } = await params;
  return teamPageMetadata(locale, teamId, "tabPlayersHistory");
}

const PAGE_SIZE = 20;

export default async function TeamHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; teamSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { teamId } = await params;
  const id = parseEntityId(teamId);
  if (id === null) notFound();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [team, roster, nameHistory, t] = await Promise.all([
    getTeamPageInfo(id),
    getTeamRoster(id, { formers: { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE } }),
    getTeamNameHistory(id),
    getTranslations("teamPage"),
  ]);
  if (!team) notFound();
  const basePath = `${team.id}/${slugify(team.name)}`;

  const totalPages = Math.max(1, Math.ceil(roster.formersTotal / PAGE_SIZE));
  const buildHref = (p: number) => `/team/${basePath}/history${p > 1 ? `?page=${p}` : ""}`;

  return (
    <div>
      <div className="mx-auto max-w-[1000px] px-6 py-7 pb-[70px]">
        <h1 className="mb-6 text-lg font-black tracking-tight text-neutral-50">{t("historyTitle", { team: team.name })}</h1>

        <div className="flex flex-col gap-8">
          <TeamRoster members={roster.current} />

          <div>
            <TeamFormerMembers members={roster.formers} segment={basePath} limit={null} linkHref={null} />
            <ListPagination
              page={page}
              totalPages={totalPages}
              prevHref={buildHref(page - 1)}
              nextHref={buildHref(page + 1)}
              previousLabel={t("historyPrevious")}
              nextLabel={t("historyNext")}
              pageOfLabel={t("historyPageOf", { page, total: totalPages })}
            />
          </div>

          {nameHistory.length > 1 && (
            <div>
              <h2 className="mb-3 text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("historyNameHistory")}</h2>
              <div className="overflow-hidden rounded-xl border border-neutral-800">
                {nameHistory.map((n) => (
                  <div key={n.id} className="flex items-center justify-between gap-3 border-b border-neutral-900 bg-[var(--gcs-surface-2)] p-3 last:border-b-0">
                    <span className="text-[13.5px] font-semibold text-neutral-100">{n.name}</span>
                    <span className="font-mono text-[10.5px] text-neutral-600">
                      {displayMonthYear(n.since, t("unknownDate"))} – {displayMonthYear(n.until, t("unknownDate"))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
