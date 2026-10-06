/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader, getPublicTournamentStages } from "@/lib/tournament-bracket-data";
import { getTournamentParticipants, getTournamentRecentMatches } from "@/lib/tournament-page-data";
import { findOrCreateThreadFor } from "@/lib/forum-threads";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { TournamentOverview } from "@/components/tournament/tournament-overview";
import { TournamentTeamsPanel } from "@/components/tournament/tournament-teams-panel";
import { RecentMatchesPanel } from "@/components/matches/recent-matches-panel";
import { ForumThreadPanel } from "@/components/forum/forum-thread-panel";
import type { Metadata } from "next";
import { tournamentPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  return tournamentPageMetadata(locale, tournamentId);
}

async function TournamentDiscussion({ tournamentId, basePath, page }: { tournamentId: number; basePath: string; page: number }) {
  const threadId = await findOrCreateThreadFor("tournament", tournamentId);
  return <ForumThreadPanel threadId={threadId} page={page} buildHref={(p) => `/tournaments/${basePath}?discussionPage=${p}`} />;
}

/**
 * Overview + recent matches + teams panel all depend on the tournament's
 * bracket stages (the slowest query on this page), so they're grouped in one
 * Suspense boundary below the header rather than blocking the whole page —
 * the header (fast, single row) can paint immediately while this streams in.
 */
async function TournamentBody({ id, basePath, activeStageId, t }: { id: number; basePath: string; activeStageId: number | null; t: Awaited<ReturnType<typeof getTranslations>> }) {
  const recentMatchesPromise = getTournamentRecentMatches(id);
  const { stages, activeStage } = await getPublicTournamentStages(id, activeStageId);
  const [recentMatches, participants] = await Promise.all([recentMatchesPromise, getTournamentParticipants(id, activeStage?.id ?? null)]);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TournamentOverview basePath={basePath} stages={stages} activeStage={activeStage} />
        </div>
        <div className="lg:col-span-4">
          <RecentMatchesPanel
            matches={recentMatches}
            title={t("recentMatches")}
            seeAllHref={`/tournaments/${basePath}/matches`}
            seeAllLabel={t("seeAll")}
            emptyLabel={t("noMatches")}
            highlightWinner={false}
          />
        </div>
      </div>

      <TournamentTeamsPanel
        participants={participants}
        title={t("teamsParticipating")}
        showAllLabel={t("showAllRosters")}
        hideAllLabel={t("hideAllRosters")}
        showRosterLabel={t("showRoster")}
        hideRosterLabel={t("hideRoster")}
        noRosterLabel={t("noRoster")}
        emptyLabel={t("noParticipants")}
      />
    </>
  );
}

function TournamentBodySkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-[420px] animate-pulse rounded-2xl border border-neutral-800 lg:col-span-8" style={{ background: "var(--gcs-surface-3)" }} />
        <div className="h-[420px] animate-pulse rounded-2xl border border-neutral-800 lg:col-span-4" style={{ background: "var(--gcs-surface-3)" }} />
      </div>
      <div className="h-64 w-full animate-pulse rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }} />
    </>
  );
}

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; tournamentSlug: string }>;
  searchParams: Promise<{ stage?: string; discussionPage?: string }>;
}) {
  const { tournamentId } = await params;
  const sp = await searchParams;
  const id = parseEntityId(tournamentId);
  if (id === null) notFound();
  const discussionPage = Math.max(1, Number(sp.discussionPage) || 1);

  const tournament = await getPublicTournamentHeader(id);
  if (!tournament) notFound();

  const activeStageId = sp.stage ? Number(sp.stage) : null;
  const t = await getTranslations("tournamentPage");
  // Tournaments use two separate path segments (`/tournaments/{id}/{slug}`),
  // same as team/player, unlike organization's merged "id-slug" single
  // segment (see lib/entity-id.ts). `tournamentSlug` itself is never read
  // back (cosmetic only, same "never validated" rule as everywhere else),
  // only re-derived here so in-page links stay well-formed.
  const basePath = `${tournament.id}/${slugify(tournament.name)}`;

  return (
    <div>
      <TournamentHeader tournament={tournament} basePath={basePath} activeTab="overview" />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-6 py-7 pb-[70px]">
        <Suspense fallback={<TournamentBodySkeleton />}>
          <TournamentBody id={id} basePath={basePath} activeStageId={activeStageId} t={t} />
        </Suspense>

        <div>
          <h2 className="mb-4 text-lg font-bold text-neutral-100">{t("discussion")}</h2>
          <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }} />}>
            <TournamentDiscussion tournamentId={id} basePath={basePath} page={discussionPage} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
