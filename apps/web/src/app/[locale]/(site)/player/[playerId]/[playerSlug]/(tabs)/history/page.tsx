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
import {
  getPlayerPageInfo,
  getPlayerTeamHistory,
} from "@/lib/player-page-data";
import { PlayerCurrentTeam } from "@/components/player/player-current-team";
import { PlayerFormerTeams } from "@/components/player/player-former-teams";
import { ListPagination } from "@/components/filters/list-pagination";
import type { Metadata } from "next";
import { playerPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; playerId: string }> }): Promise<Metadata> {
  const { locale, playerId } = await params;
  return playerPageMetadata(locale, playerId, "tabTeamsHistory");
}

const PAGE_SIZE = 20;

export default async function PlayerHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string; playerSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { playerId } = await params;
  const id = parseEntityId(playerId);
  if (id === null) notFound();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [player, teamHistory, t] = await Promise.all([
    getPlayerPageInfo(id),
    getPlayerTeamHistory(id),
    getTranslations("playerPage"),
  ]);
  if (!player) notFound();
  const basePath = `${player.id}/${slugify(player.handle)}`;

  const totalPages = Math.max(
    1,
    Math.ceil(teamHistory.formers.length / PAGE_SIZE),
  );
  const pageFormers = teamHistory.formers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const buildHref = (p: number) =>
    `/player/${basePath}/history${p > 1 ? `?page=${p}` : ""}`;

  return (
    <div>
      <div className="mx-auto max-w-[1000px] px-6 py-7 pb-[70px]">
        <h1 className="mb-6 text-lg font-black tracking-tight text-neutral-50">
          {t("historyTitle", { player: player.handle })}
        </h1>

        <div className="flex flex-col gap-8">
          <PlayerCurrentTeam
            teams={teamHistory.current}
            pronouns={player.pronouns}
          />

          <div>
            <PlayerFormerTeams
              teams={pageFormers}
              pronouns={player.pronouns}
              segment={basePath}
              limit={null}
              linkHref={null}
            />
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
        </div>
      </div>
    </div>
  );
}
