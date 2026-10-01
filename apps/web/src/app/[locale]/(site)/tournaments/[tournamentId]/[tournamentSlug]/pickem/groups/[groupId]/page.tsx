/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import { getGroupDetail, getPickemEnabledStages, computeStageLeaderboard, getGroupPhaseScoringConfig } from "@/lib/pickem/pickem-data";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { PickemLeaderboardTable } from "@/components/pickem/pickem-leaderboard-table";
import { GroupScoringPanel } from "@/components/pickem/group-scoring-panel";
import { LeaveGroupButton } from "@/components/pickem/leave-group-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PhaseScoringConfig } from "@/lib/pickem/scoring";
import { DEFAULT_PICKEM_SCORING } from "@/lib/pickem/scoring";

export default async function PickemGroupDetailPage({ params }: { params: Promise<{ tournamentId: string; tournamentSlug: string; groupId: string }> }) {
  const { tournamentId, groupId } = await params;
  const id = parseEntityId(tournamentId);
  const parsedGroupId = parseEntityId(groupId);
  if (id === null || parsedGroupId === null) notFound();

  const tournament = await getPublicTournamentHeader(id);
  if (!tournament) notFound();

  const group = await getGroupDetail(parsedGroupId);
  if (!group || group.tournamentId !== id) notFound();

  const basePath = `${tournament.id}/${slugify(tournament.name)}`;
  const t = await getTranslations("pickemPage.groups");

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isMember = userId !== null && group.members.some((m) => m.userId === userId);
  if (!isMember) notFound();

  const stages = await getPickemEnabledStages(id);
  const configByStageId: Record<number, PhaseScoringConfig> = {};
  const leaderboardByStage = new Map<number, Awaited<ReturnType<typeof computeStageLeaderboard>>>();
  for (const stage of stages) {
    const config = group.scoringMode === "custom" ? await getGroupPhaseScoringConfig(group.id, stage.id) : DEFAULT_PICKEM_SCORING;
    configByStageId[stage.id] = config;
    leaderboardByStage.set(stage.id, await computeStageLeaderboard(stage.id, config, group.members.map((m) => m.userId)));
  }

  const totalScoreByUserId = new Map<string, number>();
  for (const entries of leaderboardByStage.values()) {
    for (const entry of entries) totalScoreByUserId.set(entry.userId, (totalScoreByUserId.get(entry.userId) ?? 0) + entry.score);
  }
  const usernameByUserId = new Map(group.members.map((m) => [m.userId, m.username]));
  const overallLeaderboard = group.members
    .map((m) => ({ userId: m.userId, username: usernameByUserId.get(m.userId) ?? null, score: totalScoreByUserId.get(m.userId) ?? 0, totalMatchPicks: 0, correctMatchPicks: 0, totalStandingPicks: 0, correctStandingPicks: 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      <TournamentHeader tournament={tournament} basePath={basePath} activeTab="pickem" />

      <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-6 py-7 pb-[70px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            {group.name}
            {group.ownerUserId === userId && <Badge variant="outline">{t("ownerBadge")}</Badge>}
          </h1>
          {userId && group.ownerUserId !== userId && <LeaveGroupButton groupId={group.id} redirectHref={`/tournaments/${basePath}/pickem/groups`} />}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("joinCodeTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-lg tracking-widest">{group.joinCode}</p>
            <p className="text-sm text-muted-foreground">{t("joinCodeHint")}</p>
          </CardContent>
        </Card>

        {userId === group.ownerUserId && (
          <GroupScoringPanel groupId={group.id} scoringMode={group.scoringMode} stages={stages} configByStageId={configByStageId} />
        )}

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t("overallLeaderboardTitle")}</h2>
          <PickemLeaderboardTable entries={overallLeaderboard} currentUserId={userId} />
        </div>

        {stages.map((stage) => (
          <div key={stage.id} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{stage.name}</h2>
            <PickemLeaderboardTable entries={leaderboardByStage.get(stage.id) ?? []} currentUserId={userId} />
          </div>
        ))}
      </div>
    </div>
  );
}
