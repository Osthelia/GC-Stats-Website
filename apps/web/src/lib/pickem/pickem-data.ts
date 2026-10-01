/**
 * GC-Stats - pickem-data
 *
 * Data layer for the pick'em feature: stage status/lock windows, saving and
 * validating user picks, and computing leaderboards (global and per group).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { pickemStageSettings, pickemGroupPhasePoints, pickemMatchPicks, pickemStandingPicks, pickemGroups, pickemGroupMembers, matches, stageContainers, groupEntries, users } from "@gc-stats/db";
import { getStageEditorData, type EditorMatch, type EditorEdge } from "@/lib/admin-bracket-editor-data";
import { listTournamentStages } from "@/lib/admin-tournament-detail";
import { computeContainerStandings } from "@/lib/bracket/standings";
import { computeVirtualBracket, getPickableMatches } from "./bracket-fill";
import { scoreBracketMatchPick, scoreStandingPick, DEFAULT_PICKEM_SCORING, type PhaseScoringConfig } from "./scoring";

export type PickemStagePhase = { id: number; name: string; status: "pending" | "active" | "completed" };

/**
 * Every bracket-type container's matches/edges of a stage, combined as one
 * set — never sliced per container, a double/triple elimination stage
 * routes a match's loser into a DIFFERENT container (its own bracket-engine
 * "swimlane") via the same `bracketEdges` mechanism as a winner into the
 * next round. See `computeVirtualBracket`'s docstring.
 */
function getStageBracketMatchesAndEdges(editorData: Awaited<ReturnType<typeof getStageEditorData>> & object) {
  const containerIds = new Set(editorData.containers.filter((c) => c.containerType === "bracket").map((c) => c.id));
  const bracketMatches = editorData.matches.filter((m) => containerIds.has(m.containerId));
  const matchIds = new Set(bracketMatches.map((m) => m.id));
  const bracketEdges = editorData.edges.filter((e) => matchIds.has(e.fromMatchId) && matchIds.has(e.toMatchId));
  return { bracketMatches, bracketEdges };
}

/** Public-facing stage list for a tournament's pick'em tab — active (publicly visible) stages with pick'em enabled, in stage order. */
export async function getPickemEnabledStages(tournamentId: number): Promise<PickemStagePhase[]> {
  const stages = await listTournamentStages(tournamentId);
  return stages.filter((s) => s.active && s.pickemEnabled).map((s) => ({ id: s.id, name: s.name, status: s.status }));
}

export type PickemPhase = "notConfigured" | "notOpenYet" | "open" | "locked";

export type StagePickemStatus = {
  stageId: number;
  enabled: boolean;
  opensAt: string | null;
  closesAt: string | null;
  phase: PickemPhase;
};

/** Closes at the stage's own earliest match `scheduledAt` — computed here, never stored. */
export async function getStagePickemStatus(stageId: number): Promise<StagePickemStatus> {
  const [settings] = await db.select().from(pickemStageSettings).where(eq(pickemStageSettings.stageId, stageId));
  const [row] = await db
    .select({ earliest: sql<Date | null>`min(${matches.scheduledAt})` })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .where(eq(stageContainers.stageId, stageId));

  const closesAt = row?.earliest ?? null;
  const enabled = settings?.enabled ?? false;
  const opensAt = settings?.opensAt ?? null;

  let phase: PickemPhase = "notConfigured";
  if (enabled && opensAt) {
    const now = new Date();
    if (now < opensAt) phase = "notOpenYet";
    else if (closesAt !== null && now >= closesAt) phase = "locked";
    else phase = "open";
  }

  return { stageId, enabled, opensAt: opensAt ? opensAt.toISOString() : null, closesAt: closesAt ? closesAt.toISOString() : null, phase };
}

export async function getUserBracketPicks(userId: string, stageId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({ matchId: pickemMatchPicks.matchId, entrantId: pickemMatchPicks.predictedWinnerEntrantId })
    .from(pickemMatchPicks)
    .where(and(eq(pickemMatchPicks.userId, userId), eq(pickemMatchPicks.stageId, stageId)));
  return new Map(rows.map((r) => [r.matchId, r.entrantId]));
}

/** containerId -> predictedRank -> entrantId */
export async function getUserStandingPicks(userId: string, stageId: number): Promise<Map<number, Map<number, number>>> {
  const rows = await db
    .select({ containerId: pickemStandingPicks.containerId, entrantId: pickemStandingPicks.entrantId, predictedRank: pickemStandingPicks.predictedRank })
    .from(pickemStandingPicks)
    .where(and(eq(pickemStandingPicks.userId, userId), eq(pickemStandingPicks.stageId, stageId)));
  const result = new Map<number, Map<number, number>>();
  for (const r of rows) {
    const inner = result.get(r.containerId) ?? new Map<number, number>();
    inner.set(r.predictedRank, r.entrantId);
    result.set(r.containerId, inner);
  }
  return result;
}

export type PickFormBracketContainer = { containerId: number; name: string };

export type PickFormGroupContainer = {
  containerId: number;
  name: string;
  entrants: { id: number; name: string }[];
};

export type PickFormData = {
  tournamentId: number;
  entrantNames: Record<number, string>;
  bracketContainers: PickFormBracketContainer[];
  bracketMatches: EditorMatch[];
  bracketEdges: EditorEdge[];
  groupContainers: PickFormGroupContainer[];
  initialMatchPicks: Record<number, number>;
  initialStandingPicks: Record<number, Record<number, number>>;
};

/**
 * Ships the raw matches/edges to the client (not a pre-computed pick list) —
 * the pick form must recompute the virtual bracket reactively as the user
 * clicks winners (a round-1 pick changes round-2's displayed teams), using
 * the same pure `computeVirtualBracket` this module uses server-side.
 * `bracketMatches`/`bracketEdges` span every bracket container of the stage
 * together (not sliced per container) — see `computeVirtualBracket`'s
 * docstring for why a double/triple elimination stage needs that.
 */
export async function getPickFormData(userId: string, stageId: number): Promise<PickFormData | null> {
  const editorData = await getStageEditorData(stageId);
  if (!editorData) return null;

  const entrantNames: Record<number, string> = {};
  for (const e of editorData.entrants) entrantNames[e.id] = e.displayName;

  const userMatchPicks = await getUserBracketPicks(userId, stageId);
  const userStandingPicks = await getUserStandingPicks(userId, stageId);

  const groupContainerRows = editorData.containers.filter((c) => c.containerType === "group");
  const groupEntryRows = groupContainerRows.length
    ? await db
        .select({ containerId: groupEntries.containerId, entrantId: groupEntries.entrantId })
        .from(groupEntries)
        .where(inArray(groupEntries.containerId, groupContainerRows.map((c) => c.id)))
    : [];
  const entrantIdsByContainer = new Map<number, number[]>();
  for (const row of groupEntryRows) {
    const list = entrantIdsByContainer.get(row.containerId) ?? [];
    list.push(row.entrantId);
    entrantIdsByContainer.set(row.containerId, list);
  }

  const groupContainers: PickFormGroupContainer[] = groupContainerRows.map((c) => ({
    containerId: c.id,
    name: c.name,
    entrants: (entrantIdsByContainer.get(c.id) ?? []).map((id) => ({ id, name: entrantNames[id] ?? `#${id}` })),
  }));

  const bracketContainers: PickFormBracketContainer[] = editorData.containers.filter((c) => c.containerType === "bracket").map((c) => ({ containerId: c.id, name: c.name }));
  const { bracketMatches, bracketEdges } = getStageBracketMatchesAndEdges(editorData);

  const initialMatchPicks: Record<number, number> = {};
  for (const [matchId, entrantId] of userMatchPicks) initialMatchPicks[matchId] = entrantId;

  const initialStandingPicks: Record<number, Record<number, number>> = {};
  for (const [containerId, ranks] of userStandingPicks) {
    const inner: Record<number, number> = {};
    for (const [rank, entrantId] of ranks) inner[rank] = entrantId;
    initialStandingPicks[containerId] = inner;
  }

  return { tournamentId: editorData.tournamentId, entrantNames, bracketContainers, bracketMatches, bracketEdges, groupContainers, initialMatchPicks, initialStandingPicks };
}

export type SavePicksInput = {
  matchPicks: { matchId: number; entrantId: number }[];
  standingPicks: { containerId: number; entrantId: number; predictedRank: number }[];
};

export type SavePicksResult = { ok: true } | { ok: false; error: string };

/**
 * Re-derives the whole virtual bracket from the SUBMITTED picks (not the
 * stored ones) so a save is only ever accepted if it's internally
 * consistent — every predicted winner must actually be one of the two
 * entrants the rest of the submission puts at that slot, and every group
 * container must get a full 1..N ranking, no gaps or duplicates.
 */
export async function saveStagePicks(userId: string, stageId: number, input: SavePicksInput): Promise<SavePicksResult> {
  const status = await getStagePickemStatus(stageId);
  if (status.phase === "locked") return { ok: false, error: "locked" };
  if (status.phase !== "open") return { ok: false, error: "notOpen" };

  const editorData = await getStageEditorData(stageId);
  if (!editorData) return { ok: false, error: "stageNotFound" };

  const matchPickMap = new Map(input.matchPicks.map((p) => [p.matchId, p.entrantId]));
  const standingByContainer = new Map<number, Map<number, number>>();
  for (const p of input.standingPicks) {
    const inner = standingByContainer.get(p.containerId) ?? new Map<number, number>();
    if (inner.has(p.predictedRank)) return { ok: false, error: "duplicateRank" };
    inner.set(p.predictedRank, p.entrantId);
    standingByContainer.set(p.containerId, inner);
  }
  const predictedGroupRank = (containerId: number, rank: number): number | null => standingByContainer.get(containerId)?.get(rank) ?? null;

  const validMatchIds = new Set<number>();
  {
    const { bracketMatches, bracketEdges } = getStageBracketMatchesAndEdges(editorData);
    const virtual = computeVirtualBracket(bracketMatches, bracketEdges, matchPickMap, predictedGroupRank);
    for (const vm of getPickableMatches(virtual)) {
      validMatchIds.add(vm.matchId);
      const submitted = matchPickMap.get(vm.matchId);
      if (submitted === undefined) return { ok: false, error: "missingPick" };
      if (submitted !== vm.a.entrantId && submitted !== vm.b.entrantId) return { ok: false, error: "invalidPick" };
    }
  }
  if (input.matchPicks.some((p) => !validMatchIds.has(p.matchId))) return { ok: false, error: "invalidPick" };

  const groupContainerIds = editorData.containers.filter((c) => c.containerType === "group").map((c) => c.id);
  const groupEntryRows = groupContainerIds.length
    ? await db.select({ containerId: groupEntries.containerId, entrantId: groupEntries.entrantId }).from(groupEntries).where(inArray(groupEntries.containerId, groupContainerIds))
    : [];
  const entrantIdsByContainer = new Map<number, number[]>();
  for (const row of groupEntryRows) {
    const list = entrantIdsByContainer.get(row.containerId) ?? [];
    list.push(row.entrantId);
    entrantIdsByContainer.set(row.containerId, list);
  }
  for (const [containerId, realEntrantIds] of entrantIdsByContainer) {
    const picks = standingByContainer.get(containerId);
    if (!picks || picks.size !== realEntrantIds.length) return { ok: false, error: "incompleteStandingPicks" };
    const pickedEntrantIds = new Set(picks.values());
    if (pickedEntrantIds.size !== realEntrantIds.length) return { ok: false, error: "duplicateEntrant" };
    for (const id of realEntrantIds) if (!pickedEntrantIds.has(id)) return { ok: false, error: "invalidPick" };
    for (let rank = 1; rank <= realEntrantIds.length; rank++) if (!picks.has(rank)) return { ok: false, error: "invalidRank" };
  }
  for (const containerId of standingByContainer.keys()) {
    if (!entrantIdsByContainer.has(containerId)) return { ok: false, error: "invalidPick" };
  }

  await db.transaction(async (tx) => {
    await tx.delete(pickemMatchPicks).where(and(eq(pickemMatchPicks.userId, userId), eq(pickemMatchPicks.stageId, stageId)));
    await tx.delete(pickemStandingPicks).where(and(eq(pickemStandingPicks.userId, userId), eq(pickemStandingPicks.stageId, stageId)));

    if (input.matchPicks.length > 0) {
      await tx.insert(pickemMatchPicks).values(input.matchPicks.map((p) => ({ userId, stageId, matchId: p.matchId, predictedWinnerEntrantId: p.entrantId })));
    }
    if (input.standingPicks.length > 0) {
      await tx.insert(pickemStandingPicks).values(input.standingPicks.map((p) => ({ userId, stageId, containerId: p.containerId, entrantId: p.entrantId, predictedRank: p.predictedRank })));
    }
  });

  return { ok: true };
}

export type LeaderboardEntry = {
  userId: string;
  username: string | null;
  score: number;
  totalMatchPicks: number;
  correctMatchPicks: number;
  totalStandingPicks: number;
  correctStandingPicks: number;
};

/**
 * Live score for every user who made at least one pick on this stage —
 * scored on-the-fly from current match/standings state (matches not yet
 * completed simply contribute 0), never cached. Each participant's own
 * saved picks re-derive their virtual bracket (needed for the "team
 * correct" signal, which depends on their predicted OPPONENT, never stored
 * directly).
 */
export async function computeStageLeaderboard(stageId: number, config: PhaseScoringConfig, restrictToUserIds?: string[]): Promise<LeaderboardEntry[]> {
  const editorData = await getStageEditorData(stageId);
  if (!editorData) return [];

  const matchPickRows = await db.select().from(pickemMatchPicks).where(eq(pickemMatchPicks.stageId, stageId));
  const standingPickRows = await db.select().from(pickemStandingPicks).where(eq(pickemStandingPicks.stageId, stageId));

  let participantIds = new Set<string>([...matchPickRows.map((r) => r.userId), ...standingPickRows.map((r) => r.userId)]);
  if (restrictToUserIds) {
    const allowed = new Set(restrictToUserIds);
    participantIds = new Set([...participantIds].filter((id) => allowed.has(id)));
  }
  if (participantIds.size === 0) return [];

  const matchById = new Map(editorData.matches.map((m) => [m.id, m]));
  const { bracketMatches, bracketEdges } = getStageBracketMatchesAndEdges(editorData);
  const bracketMatchIds = new Set(bracketMatches.map((m) => m.id));

  const groupContainers = editorData.containers.filter((c) => c.containerType === "group" && c.status === "completed");
  const rankByContainerAndEntrant = new Map<number, Map<number, number>>();
  for (const c of groupContainers) {
    const ranked = await computeContainerStandings(db, c.id, c.config);
    rankByContainerAndEntrant.set(c.id, new Map(ranked.map((r) => [Number(r.id), r.rank])));
  }

  const userNameById = new Map<string, string | null>();
  if (participantIds.size > 0) {
    const userRows = await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, [...participantIds]));
    for (const u of userRows) userNameById.set(u.id, u.username);
  }

  const entries: LeaderboardEntry[] = [];
  for (const userId of participantIds) {
    const userMatchPicks = matchPickRows.filter((r) => r.userId === userId);
    const userStandingPicks = standingPickRows.filter((r) => r.userId === userId);

    const predictedWinners = new Map(userMatchPicks.map((r) => [r.matchId, r.predictedWinnerEntrantId]));
    const standingRanksByContainer = new Map<number, Map<number, number>>();
    for (const r of userStandingPicks) {
      const inner = standingRanksByContainer.get(r.containerId) ?? new Map<number, number>();
      inner.set(r.predictedRank, r.entrantId);
      standingRanksByContainer.set(r.containerId, inner);
    }
    const predictedGroupRank = (containerId: number, rank: number): number | null => standingRanksByContainer.get(containerId)?.get(rank) ?? null;

    let score = 0;
    let correctMatchPicks = 0;

    {
      const virtual = computeVirtualBracket(bracketMatches, bracketEdges, predictedWinners, predictedGroupRank);
      for (const [matchId, predictedWinnerId] of predictedWinners) {
        if (!bracketMatchIds.has(matchId)) continue;
        const vm = virtual.get(matchId);
        const match = matchById.get(matchId);
        if (!vm || !match) continue;
        const predictedOpponentId = vm.a.entrantId === predictedWinnerId ? vm.b.entrantId : vm.a.entrantId;
        const matchScore = scoreBracketMatchPick({
          predictedWinnerId,
          predictedOpponentId,
          round: match.round,
          actualEntrantAId: match.entrantAId,
          actualEntrantBId: match.entrantBId,
          actualWinnerId: match.winnerId,
          config,
        });
        score += matchScore;
        if (match.winnerId !== null && match.winnerId === predictedWinnerId) correctMatchPicks++;
      }
    }

    let correctStandingPicks = 0;
    for (const r of userStandingPicks) {
      const actualRank = rankByContainerAndEntrant.get(r.containerId)?.get(r.entrantId) ?? null;
      score += scoreStandingPick(r.predictedRank, actualRank, config);
      if (actualRank !== null && actualRank === r.predictedRank) correctStandingPicks++;
    }

    entries.push({
      userId,
      username: userNameById.get(userId) ?? null,
      score,
      totalMatchPicks: userMatchPicks.length,
      correctMatchPicks,
      totalStandingPicks: userStandingPicks.length,
      correctStandingPicks,
    });
  }

  entries.sort((a, b) => b.score - a.score);
  return entries;
}

export type PickemGroupSummary = { id: number; name: string; scoringMode: "default" | "custom"; memberCount: number; isOwner: boolean };

export async function getMyGroupsForTournament(userId: string, tournamentId: number): Promise<PickemGroupSummary[]> {
  const groupRows = await db.select().from(pickemGroups).where(eq(pickemGroups.tournamentId, tournamentId));
  if (groupRows.length === 0) return [];

  const groupIds = groupRows.map((g) => g.id);
  const memberRows = await db.select({ groupId: pickemGroupMembers.groupId, userId: pickemGroupMembers.userId }).from(pickemGroupMembers).where(inArray(pickemGroupMembers.groupId, groupIds));

  const memberIdsByGroup = new Map<number, string[]>();
  for (const r of memberRows) {
    const list = memberIdsByGroup.get(r.groupId) ?? [];
    list.push(r.userId);
    memberIdsByGroup.set(r.groupId, list);
  }

  return groupRows
    .filter((g) => (memberIdsByGroup.get(g.id) ?? []).includes(userId))
    .map((g) => ({ id: g.id, name: g.name, scoringMode: g.scoringMode, memberCount: (memberIdsByGroup.get(g.id) ?? []).length, isOwner: g.ownerUserId === userId }));
}

export type PickemGroupDetail = {
  id: number;
  name: string;
  tournamentId: number;
  ownerUserId: string;
  scoringMode: "default" | "custom";
  joinCode: string;
  members: { userId: string; username: string | null }[];
};

export async function getGroupDetail(groupId: number): Promise<PickemGroupDetail | null> {
  const [group] = await db.select().from(pickemGroups).where(eq(pickemGroups.id, groupId)).limit(1);
  if (!group) return null;

  const memberRows = await db
    .select({ userId: pickemGroupMembers.userId, username: users.username })
    .from(pickemGroupMembers)
    .innerJoin(users, eq(users.id, pickemGroupMembers.userId))
    .where(eq(pickemGroupMembers.groupId, groupId));

  return {
    id: group.id,
    name: group.name,
    tournamentId: group.tournamentId,
    ownerUserId: group.ownerUserId,
    scoringMode: group.scoringMode,
    joinCode: group.joinCode,
    members: memberRows,
  };
}

export async function getGroupPhaseScoringConfig(groupId: number, stageId: number): Promise<PhaseScoringConfig> {
  const [row] = await db.select().from(pickemGroupPhasePoints).where(and(eq(pickemGroupPhasePoints.groupId, groupId), eq(pickemGroupPhasePoints.stageId, stageId)));
  if (!row) return DEFAULT_PICKEM_SCORING;
  return {
    teamCorrectPoints: row.teamCorrectPoints,
    outcomeCorrectPoints: row.outcomeCorrectPoints,
    advancementPerRoundPoints: row.advancementPerRoundPoints,
    standingRankPoints: row.standingRankPoints,
  };
}

export type PickemScope = { kind: "global" } | { kind: "group"; groupId: number; groupName: string };
export type PickemScopedLeaderboard = { scope: PickemScope; config: PhaseScoringConfig; leaderboard: LeaderboardEntry[] };

/**
 * The "global" (public, default-scoring) leaderboard plus one per pick'em
 * group the user belongs to for this tournament — each group scores with
 * its own config (default or custom per phase) and is restricted to its own
 * members, mirroring `/pickem/groups/{id}`'s per-stage leaderboard exactly.
 * Lets the stage page show a single points-at-stake figure under each match
 * and a switchable leaderboard, both consistent with whichever scope the
 * viewer picked.
 */
export async function getStageScoringScopes(stageId: number, tournamentId: number, userId: string | null): Promise<PickemScopedLeaderboard[]> {
  const scopes: PickemScopedLeaderboard[] = [{ scope: { kind: "global" }, config: DEFAULT_PICKEM_SCORING, leaderboard: await computeStageLeaderboard(stageId, DEFAULT_PICKEM_SCORING) }];
  if (!userId) return scopes;

  const groups = await getMyGroupsForTournament(userId, tournamentId);
  for (const g of groups) {
    const detail = await getGroupDetail(g.id);
    if (!detail) continue;
    const config = g.scoringMode === "custom" ? await getGroupPhaseScoringConfig(g.id, stageId) : DEFAULT_PICKEM_SCORING;
    const leaderboard = await computeStageLeaderboard(
      stageId,
      config,
      detail.members.map((m) => m.userId)
    );
    scopes.push({ scope: { kind: "group", groupId: g.id, groupName: g.name }, config, leaderboard });
  }
  return scopes;
}
