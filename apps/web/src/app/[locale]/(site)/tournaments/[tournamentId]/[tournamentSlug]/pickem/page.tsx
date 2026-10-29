/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader, pickDefaultStage } from "@/lib/tournament-bracket-data";
import { getPickemEnabledStages, getStagePickemStatus, getPickFormData, getStageScoringScopes } from "@/lib/pickem/pickem-data";
import { ensureStageRewardsComputed, getStageRewards } from "@/lib/pickem/rewards";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { PickemLeaderboardTable } from "@/components/pickem/pickem-leaderboard-table";
import { PickemStatusMessage } from "@/components/pickem/pickem-status-message";
import { PickemStageBoard, type PickemScopeTabInput } from "@/components/pickem/pickem-stage-board";
import { PageLoading } from "@/components/site/page-loading";
import type { Metadata } from "next";
import { tournamentPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  return tournamentPageMetadata(locale, tournamentId, "tournamentPage.tabPickem");
}

export default async function TournamentPickemPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; tournamentSlug: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { tournamentId } = await params;
  const sp = await searchParams;
  const id = parseEntityId(tournamentId);
  if (id === null) notFound();

  const tournament = await getPublicTournamentHeader(id);
  if (!tournament) notFound();

  const basePath = `${tournament.id}/${slugify(tournament.name)}`;
  const t = await getTranslations("pickemPage");
  const requestedStageId = sp.stage ? Number(sp.stage) : null;

  return (
    <div>
      <TournamentHeader tournament={tournament} basePath={basePath} activeTab="pickem" />

      <div className="mx-auto flex max-w-[clamp(1500px,88vw,2400px)] flex-col gap-6 px-6 py-7 pb-[70px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{t("heading")}</h1>
          <Link href={`/tournaments/${basePath}/pickem/groups`} className="text-sm font-medium text-primary hover:underline">
            {t("groupsLink")}
          </Link>
        </div>

        {/* Only the pick'em zone loads, the tournament header stays in place. */}
        <Suspense fallback={<PageLoading />}>
          <PickemContent tournamentId={id} basePath={basePath} requestedStageId={requestedStageId} />
        </Suspense>
      </div>
    </div>
  );
}

async function PickemContent({ tournamentId, basePath, requestedStageId }: { tournamentId: number; basePath: string; requestedStageId: number | null }) {
  const t = await getTranslations("pickemPage");
  const [stages, session] = await Promise.all([getPickemEnabledStages(tournamentId), auth()]);
  const activeStage = stages.find((s) => s.id === requestedStageId) ?? pickDefaultStage(stages) ?? null;
  const userId = session?.user?.id ?? null;

  return (
    <>
      {stages.length === 0 && <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{t("noPhaseConfigured")}</p>}

      {stages.length > 0 && activeStage && (
        <>
          {stages.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage) => {
                const on = stage.id === activeStage.id;
                return (
                  <Link
                    key={stage.id}
                    href={{ pathname: `/tournaments/${basePath}/pickem`, query: { stage: stage.id } }}
                    className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all duration-200 active:scale-[0.96] ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                  >
                    {stage.name}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Keyed so the loader shows again on every stage change, the stage tabs stay in place. */}
          <Suspense key={activeStage.id} fallback={<PageLoading />}>
            <PickemStageSection stageId={activeStage.id} tournamentId={tournamentId} userId={userId} />
          </Suspense>
        </>
      )}
    </>
  );
}

const GLOBAL_SCOPE_ID = 0;

async function PickemStageSection({ stageId, tournamentId, userId }: { stageId: number; tournamentId: number; userId: string | null }) {
  const t = await getTranslations("pickemPage");
  const status = await getStagePickemStatus(stageId);

  if (status.phase === "notConfigured") {
    return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{t("noPhaseConfigured")}</p>;
  }

  await ensureStageRewardsComputed(stageId);
  const [scopes, rewards, pickFormData] = await Promise.all([
    getStageScoringScopes(stageId, tournamentId, userId),
    getStageRewards(stageId),
    (status.phase === "open" || status.phase === "locked") && userId ? getPickFormData(userId, stageId, status) : Promise.resolve(null),
  ]);

  const rewardsByUserId = new Map<string, string[]>();
  for (const r of rewards) {
    const list = rewardsByUserId.get(r.userId) ?? [];
    list.push(r.kind);
    rewardsByUserId.set(r.userId, list);
  }

  const scopeTabs: PickemScopeTabInput[] = scopes.map((s) => ({
    id: s.scope.kind === "global" ? GLOBAL_SCOPE_ID : s.scope.groupId,
    label: s.scope.kind === "global" ? t("scopeGlobal") : s.scope.groupName,
    config: s.config,
    content: <PickemLeaderboardTable entries={s.leaderboard} rewardsByUserId={rewardsByUserId} currentUserId={userId} />,
  }));

  // Once locked, the form only comes back read-only when the user actually made picks.
  const hasPicks =
    !!pickFormData &&
    (Object.keys(pickFormData.initialMatchPicks).length > 0 || Object.keys(pickFormData.initialGroupMatchPicks).length > 0 || Object.keys(pickFormData.initialStandingPicks).length > 0);
  const isLocked = status.phase === "locked";
  const formData = isLocked && !hasPicks ? null : pickFormData;

  // Logged in users only land here without picks, visitors get why the phase is closed.
  const lockedMessageKey = userId ? "statusLockedNoPicks" : status.groupPickMode === "matches" ? "statusLockedStageCompleted" : "statusLocked";

  const leftFallback =
    status.phase === "notOpenYet" && status.opensAt ? (
      <PickemStatusMessage opensAt={status.opensAt} />
    ) : isLocked ? (
      <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">{t(lockedMessageKey)}</p>
    ) : status.phase === "open" && !userId ? (
      <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">{t("statusLoginRequired")}</p>
    ) : null;

  return <PickemStageBoard stageId={stageId} pickFormData={formData} readOnly={isLocked} leftFallback={leftFallback} scopeTabs={scopeTabs} />;
}
