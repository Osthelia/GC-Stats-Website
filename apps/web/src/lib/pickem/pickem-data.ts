/**
 * GC-Stats - pickem-data
 *
 * Data layer for the pick'em feature: stage status/lock windows, saving and
 * validating user picks, and computing leaderboards (global and per group).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { pickemStageSettings, pickemGroupPhasePoints, pickemMatchPicks, pickemStandingPicks, pickemGroups, pickemGroupMembers, matches, stageContainers, stages, groupEntries, users } from "@gc-stats/db";
import { getStageEditorData, type EditorMatch, type EditorEdge } from "@/lib/admin-bracket-editor-data";
import { listTournamentStages } from "@/lib/admin-tournament-detail";
import { computeContainerStandings } from "@/lib/bracket/standings";
import { parseGroupConfig } from "@/lib/bracket/config-types";
import { computeVirtualBracket, getPickableMatches } from "./bracket-fill";
import { scoreBracketMatchPick, scoreStandingPick, scoreGroupMatchPick, defaultPickemScoring, PICKEM_SCORING_VERSION, type PhaseScoringConfig } from "./scoring";

export type PickemStagePhase = { id: number; name: string; status: "pending" | "active" | "completed"; startDate: string | null; endDate: string | null };

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

function getStageGroupMatches(editorData: Awaited<ReturnType<typeof getStageEditorData>> & object): EditorMatch[] {
  const containerIds = new Set(editorData.containers.filter((c) => c.containerType === "group").map((c) => c.id));
  return editorData.matches.filter((m) => containerIds.has(m.containerId));
}

/** A group match takes picks until it starts, and only once both teams are known (Swiss rounds are drawn as results come in). */
export function isGroupMatchLocked(match: Pick<EditorMatch, "status" | "entrantAId" | "entrantBId" | "scheduledAt">, now: Date): boolean {
  if (match.status !== "pending" || match.entrantAId === null || match.entrantBId === null) return true;
  return match.scheduledAt !== null && now >= new Date(match.scheduledAt);
}

/** Public-facing stage list for a tournament's pick'em tab — active (publicly visible) stages with pick'em enabled, in stage order. */
export async function getPickemEnabledStages(tournamentId: number): Promise<PickemStagePhase[]> {
  const stages = await listTournamentStages(tournamentId);
  return stages.filter((s) => s.active && s.pickemEnabled).map((s) => ({ id: s.id, name: s.name, status: s.status, startDate: s.startDate, endDate: s.endDate }));
}

export type PickemPhase = "notConfigured" | "notOpenYet" | "open" | "locked";
export type PickemGroupPickMode = "standings" | "matches";

export type StagePickemStatus = {
  stageId: number;
  enabled: boolean;
  groupPickMode: PickemGroupPickMode;
  scoringVersion: number;
  opensAt: string | null;
  /** When bracket (and standings) picks close. */
  closesAt: string | null;
  phase: PickemPhase;
};

/**
 * Standings mode closes everything at the stage's earliest match. Matches
 * mode keeps the phase open until nothing is left to predict (stage
 * completed, or every group done and the bracket closed): group matches lock
 * one by one (`isGroupMatchLocked`) and bracket picks close at the earliest
 * bracket match. Deadlines are computed here, never stored.
 */
export async function getStagePickemStatus(stageId: number): Promise<StagePickemStatus> {
  const [settings] = await db.select().from(pickemStageSettings).where(eq(pickemStageSettings.stageId, stageId));
  const groupPickMode: PickemGroupPickMode = settings?.groupPickMode ?? "standings";
  const matchesMode = groupPickMode === "matches";
  const [row] = await db
    .select({ earliest: sql<Date | null>`min(${matches.scheduledAt})` })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .where(matchesMode ? and(eq(stageContainers.stageId, stageId), eq(stageContainers.containerType, "bracket")) : eq(stageContainers.stageId, stageId));
  const [stage] = matchesMode ? await db.select({ status: stages.status }).from(stages).where(eq(stages.id, stageId)) : [];
  const groupStatuses = matchesMode
    ? await db.select({ status: stageContainers.status }).from(stageContainers).where(and(eq(stageContainers.stageId, stageId), eq(stageContainers.containerType, "group")))
    : [];

  const closesAtRaw = row?.earliest ?? null;
  const closesAt = closesAtRaw
      ? new Date(closesAtRaw)
      : null;
  const enabled = settings?.enabled ?? false;
  const opensAt = settings?.opensAt ?? null;

  let phase: PickemPhase = "notConfigured";
  if (enabled && opensAt) {
    const now = new Date();
    const bracketClosed = closesAt !== null && now >= closesAt;
    const nothingLeftToPick = async () =>
      stage?.status === "completed" || (groupStatuses.every((c) => c.status === "completed") && (bracketClosed || !(await stageHasBracket(stageId))));
    if (now < opensAt) phase = "notOpenYet";
    else if (matchesMode ? await nothingLeftToPick() : bracketClosed) phase = "locked";
    else phase = "open";
  }

  return {
    stageId,
    enabled,
    groupPickMode,
    scoringVersion: settings?.scoringVersion ?? PICKEM_SCORING_VERSION,
    opensAt: opensAt ? opensAt.toISOString() : null,
    closesAt: closesAt ? closesAt.toISOString() : null,
    phase,
  };
}

async function stageHasBracket(stageId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: stageContainers.id })
    .from(stageContainers)
    .where(and(eq(stageContainers.stageId, stageId), eq(stageContainers.containerType, "bracket")))
    .limit(1);
  return !!row;
}

function isBracketLocked(status: StagePickemStatus, now: Date): boolean {
  return status.phase === "locked" || (status.closesAt !== null && now >= new Date(status.closesAt));
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
  format: "swiss" | "round_robin";
  status: "pending" | "active" | "completed";
  entrants: { id: number; name: string }[];
};

export type PickFormGroupMatch = EditorMatch & { locked: boolean };

export type PickFormData = {
  tournamentId: number;
  entrantNames: Record<number, string>;
  bracketContainers: PickFormBracketContainer[];
  bracketMatches: EditorMatch[];
  bracketEdges: EditorEdge[];
  groupContainers: PickFormGroupContainer[];
  groupPickMode: PickemGroupPickMode;
  scoringVersion: number;
  /** Matches mode only, every match of the stage's group containers. */
  groupMatches: PickFormGroupMatch[];
  bracketLocked: boolean;
  /** Bracket match picks only, group match picks are in `initialGroupMatchPicks`. */
  initialMatchPicks: Record<number, number>;
  initialGroupMatchPicks: Record<number, number>;
  initialStandingPicks: Record<number, Record<number, number>>;
  /** containerId -> entrantId -> final rank, completed group containers of a locked phase only. */
  actualStandingRanks: Record<number, Record<number, number>>;
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
export async function getPickFormData(userId: string, stageId: number, status: StagePickemStatus): Promise<PickFormData | null> {
  const editorData = await getStageEditorData(stageId);
  if (!editorData) return null;
  const now = new Date();

  const entrantNames: Record<number, string> = {};
  for (const e of editorData.entrants) entrantNames[e.id] = e.displayName;

  const [userMatchPicks, userStandingPicks] = await Promise.all([getUserBracketPicks(userId, stageId), getUserStandingPicks(userId, stageId)]);

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
    format: parseGroupConfig(c.config).type,
    status: c.status,
    entrants: (entrantIdsByContainer.get(c.id) ?? []).map((id) => ({ id, name: entrantNames[id] ?? `#${id}` })),
  }));

  const bracketContainers: PickFormBracketContainer[] = editorData.containers.filter((c) => c.containerType === "bracket").map((c) => ({ containerId: c.id, name: c.name }));
  const { bracketMatches, bracketEdges } = getStageBracketMatchesAndEdges(editorData);

  const groupMatches: PickFormGroupMatch[] = status.groupPickMode === "matches" ? getStageGroupMatches(editorData).map((m) => ({ ...m, locked: isGroupMatchLocked(m, now) })) : [];
  const groupMatchIds = new Set(groupMatches.map((m) => m.id));

  const initialMatchPicks: Record<number, number> = {};
  const initialGroupMatchPicks: Record<number, number> = {};
  for (const [matchId, entrantId] of userMatchPicks) {
    if (groupMatchIds.has(matchId)) initialGroupMatchPicks[matchId] = entrantId;
    else initialMatchPicks[matchId] = entrantId;
  }

  const initialStandingPicks: Record<number, Record<number, number>> = {};
  for (const [containerId, ranks] of userStandingPicks) {
    const inner: Record<number, number> = {};
    for (const [rank, entrantId] of ranks) inner[rank] = entrantId;
    initialStandingPicks[containerId] = inner;
  }

  // Only the locked read-only view checks standings against the real ranks.
  const rankedContainers =
    status.phase === "locked" && status.groupPickMode === "standings" ? groupContainerRows.filter((c) => c.status === "completed") : [];
  const rankings = await Promise.all(rankedContainers.map(async (c) => [c.id, await computeContainerStandings(db, c.id, c.config)] as const));
  const actualStandingRanks: Record<number, Record<number, number>> = {};
  for (const [containerId, ranked] of rankings) actualStandingRanks[containerId] = Object.fromEntries(ranked.map((r) => [Number(r.id), r.rank]));

  return {
    tournamentId: editorData.tournamentId,
    entrantNames,
    bracketContainers,
    bracketMatches,
    bracketEdges,
    groupContainers,
    groupPickMode: status.groupPickMode,
    scoringVersion: status.scoringVersion,
    groupMatches,
    bracketLocked: isBracketLocked(status, now),
    initialMatchPicks,
    initialGroupMatchPicks,
    initialStandingPicks,
    actualStandingRanks,
  };
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
 * container must get a full 1..N ranking, no gaps or duplicates. Matches
 * mode has no standings, its group picks are saved one by one by
 * `saveGroupMatchPick` and left untouched here.
 */
export async function saveStagePicks(userId: string, stageId: number, input: SavePicksInput): Promise<SavePicksResult> {
  const status = await getStagePickemStatus(stageId);
  if (isBracketLocked(status, new Date())) return { ok: false, error: "locked" };
  if (status.phase !== "open") return { ok: false, error: "notOpen" };
  const standingsMode = status.groupPickMode === "standings";
  if (!standingsMode && input.standingPicks.length > 0) return { ok: false, error: "invalidPick" };

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

  const { bracketMatches, bracketEdges } = getStageBracketMatchesAndEdges(editorData);
  const validMatchIds = new Set<number>();
  {
    const virtual = computeVirtualBracket(bracketMatches, bracketEdges, matchPickMap, predictedGroupRank);
    for (const vm of getPickableMatches(virtual)) {
      validMatchIds.add(vm.matchId);
      const submitted = matchPickMap.get(vm.matchId);
      if (submitted === undefined) return { ok: false, error: "missingPick" };
      if (submitted !== vm.a.entrantId && submitted !== vm.b.entrantId) return { ok: false, error: "invalidPick" };
    }
  }
  if (input.matchPicks.some((p) => !validMatchIds.has(p.matchId))) return { ok: false, error: "invalidPick" };

  const groupContainerIds = standingsMode ? editorData.containers.filter((c) => c.containerType === "group").map((c) => c.id) : [];
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

  const bracketMatchIds = bracketMatches.map((m) => m.id);
  await db.transaction(async (tx) => {
    if (bracketMatchIds.length > 0) {
      await tx.delete(pickemMatchPicks).where(and(eq(pickemMatchPicks.userId, userId), eq(pickemMatchPicks.stageId, stageId), inArray(pickemMatchPicks.matchId, bracketMatchIds)));
    }
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

/** Sets, or clears with a null `entrantId`, the user's winner of one Swiss/round robin match (matches mode). */
export async function saveGroupMatchPick(userId: string, stageId: number, matchId: number, entrantId: number | null): Promise<SavePicksResult> {
  const status = await getStagePickemStatus(stageId);
  if (status.phase === "locked") return { ok: false, error: "locked" };
  if (status.phase !== "open") return { ok: false, error: "notOpen" };
  if (status.groupPickMode !== "matches") return { ok: false, error: "invalidPick" };

  const editorData = await getStageEditorData(stageId);
  if (!editorData) return { ok: false, error: "stageNotFound" };

  const match = getStageGroupMatches(editorData).find((m) => m.id === matchId);
  if (!match) return { ok: false, error: "matchNotFound" };
  if (isGroupMatchLocked(match, new Date())) return { ok: false, error: "matchLocked" };
  if (entrantId !== null && entrantId !== match.entrantAId && entrantId !== match.entrantBId) return { ok: false, error: "invalidPick" };

  if (entrantId === null) {
    await db.delete(pickemMatchPicks).where(and(eq(pickemMatchPicks.userId, userId), eq(pickemMatchPicks.matchId, matchId)));
  } else {
    await db
      .insert(pickemMatchPicks)
      .values({ userId, stageId, matchId, predictedWinnerEntrantId: entrantId })
      .onConflictDoUpdate({ target: [pickemMatchPicks.userId, pickemMatchPicks.matchId], set: { predictedWinnerEntrantId: entrantId, updatedAt: new Date() } });
  }
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

type StageLeaderboardContext = {
  scoringVersion: number;
  matchById: Map<number, EditorMatch>;
  bracketMatches: EditorMatch[];
  bracketEdges: EditorEdge[];
  bracketMatchIds: Set<number>;
  groupMatchIds: Set<number>;
  matchPickRows: (typeof pickemMatchPicks.$inferSelect)[];
  standingPickRows: (typeof pickemStandingPicks.$inferSelect)[];
  rankByContainerAndEntrant: Map<number, Map<number, number>>;
  userNameById: Map<string, string | null>;
};

/** Everything a stage leaderboard needs, loaded once and scored for as many scoring configs as needed. */
async function loadStageLeaderboardContext(stageId: number): Promise<StageLeaderboardContext | null> {
  const editorData = await getStageEditorData(stageId);
  if (!editorData) return null;

  const [settings] = await db
    .select({ groupPickMode: pickemStageSettings.groupPickMode, scoringVersion: pickemStageSettings.scoringVersion })
    .from(pickemStageSettings)
    .where(eq(pickemStageSettings.stageId, stageId));
  const matchesMode = settings?.groupPickMode === "matches";
  const groupMatchIds = new Set(matchesMode ? getStageGroupMatches(editorData).map((m) => m.id) : []);
  const { bracketMatches, bracketEdges } = getStageBracketMatchesAndEdges(editorData);
  const bracketMatchIds = new Set(bracketMatches.map((m) => m.id));

  // Only picks of the stage's current group mode count.
  const [allMatchPickRows, standingPickRows] = await Promise.all([
    db.select().from(pickemMatchPicks).where(eq(pickemMatchPicks.stageId, stageId)),
    matchesMode ? Promise.resolve([]) : db.select().from(pickemStandingPicks).where(eq(pickemStandingPicks.stageId, stageId)),
  ]);
  const matchPickRows = allMatchPickRows.filter((r) => bracketMatchIds.has(r.matchId) || groupMatchIds.has(r.matchId));

  const groupContainers = matchesMode ? [] : editorData.containers.filter((c) => c.containerType === "group" && c.status === "completed");
  const rankings = await Promise.all(groupContainers.map(async (c) => [c.id, await computeContainerStandings(db, c.id, c.config)] as const));
  const rankByContainerAndEntrant = new Map(rankings.map(([containerId, ranked]) => [containerId, new Map(ranked.map((r) => [Number(r.id), r.rank]))]));

  const participantIds = [...new Set([...matchPickRows.map((r) => r.userId), ...standingPickRows.map((r) => r.userId)])];
  const userNameById = new Map<string, string | null>();
  if (participantIds.length > 0) {
    const userRows = await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, participantIds));
    for (const u of userRows) userNameById.set(u.id, u.username);
  }

  return {
    scoringVersion: settings?.scoringVersion ?? PICKEM_SCORING_VERSION,
    matchById: new Map(editorData.matches.map((m) => [m.id, m])),
    bracketMatches,
    bracketEdges,
    bracketMatchIds,
    groupMatchIds,
    matchPickRows,
    standingPickRows,
    rankByContainerAndEntrant,
    userNameById,
  };
}

/**
 * Live score for every user who made at least one counted pick on this
 * stage, scored on the fly from current match/standings state (matches not
 * yet completed simply contribute 0), never cached. Each participant's own
 * saved picks re-derive their virtual bracket (needed for the "team
 * correct" signal, which depends on their predicted OPPONENT, never stored
 * directly).
 */
function scoreStageLeaderboard(ctx: StageLeaderboardContext, config: PhaseScoringConfig, restrictToUserIds?: string[]): LeaderboardEntry[] {
  const { scoringVersion, matchById, bracketMatches, bracketEdges, bracketMatchIds, groupMatchIds, matchPickRows, standingPickRows, rankByContainerAndEntrant } = ctx;
  let participantIds = new Set<string>([...matchPickRows.map((r) => r.userId), ...standingPickRows.map((r) => r.userId)]);
  if (restrictToUserIds) {
    const allowed = new Set(restrictToUserIds);
    participantIds = new Set([...participantIds].filter((id) => allowed.has(id)));
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
      // Version 1 takes the opponent from the real bracket, version 2 from the user's own guess.
      const virtual = computeVirtualBracket(bracketMatches, bracketEdges, predictedWinners, predictedGroupRank, { guessOnly: scoringVersion >= 2 });
      for (const [matchId, predictedWinnerId] of predictedWinners) {
        if (!bracketMatchIds.has(matchId)) continue;
        const vm = virtual.get(matchId);
        const match = matchById.get(matchId);
        if (!vm || !match) continue;
        const predictedOpponentId = vm.a.entrantId === predictedWinnerId ? vm.b.entrantId : vm.a.entrantId;
        score += scoreBracketMatchPick({
          predictedWinnerId,
          predictedOpponentId,
          round: match.round,
          actualEntrantAId: match.entrantAId,
          actualEntrantBId: match.entrantBId,
          actualWinnerId: match.winnerId,
          config,
          scoringVersion,
        });
        if (match.winnerId !== null && match.winnerId === predictedWinnerId) correctMatchPicks++;
      }
    }

    for (const r of userMatchPicks) {
      if (!groupMatchIds.has(r.matchId)) continue;
      const actualWinnerId = matchById.get(r.matchId)?.winnerId ?? null;
      score += scoreGroupMatchPick(r.predictedWinnerEntrantId, actualWinnerId, config);
      if (actualWinnerId !== null && actualWinnerId === r.predictedWinnerEntrantId) correctMatchPicks++;
    }

    let correctStandingPicks = 0;
    for (const r of userStandingPicks) {
      const actualRank = rankByContainerAndEntrant.get(r.containerId)?.get(r.entrantId) ?? null;
      score += scoreStandingPick(r.predictedRank, actualRank, config);
      if (actualRank !== null && actualRank === r.predictedRank) correctStandingPicks++;
    }

    entries.push({
      userId,
      username: ctx.userNameById.get(userId) ?? null,
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

/** `config` null scores with the stage's default config (`defaultPickemScoring` of its scoring version). */
export async function computeStageLeaderboard(stageId: number, config: PhaseScoringConfig | null, restrictToUserIds?: string[]): Promise<LeaderboardEntry[]> {
  const ctx = await loadStageLeaderboardContext(stageId);
  if (!ctx) return [];
  return scoreStageLeaderboard(ctx, config ?? defaultPickemScoring(ctx.scoringVersion), restrictToUserIds);
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

async function getStageScoringVersion(stageId: number): Promise<number> {
  const [row] = await db.select({ scoringVersion: pickemStageSettings.scoringVersion }).from(pickemStageSettings).where(eq(pickemStageSettings.stageId, stageId));
  return row?.scoringVersion ?? PICKEM_SCORING_VERSION;
}

/** A group's custom points for a stage, or null when it has none saved yet. */
async function getGroupPhasePoints(groupId: number, stageId: number): Promise<PhaseScoringConfig | null> {
  const [row] = await db.select().from(pickemGroupPhasePoints).where(and(eq(pickemGroupPhasePoints.groupId, groupId), eq(pickemGroupPhasePoints.stageId, stageId)));
  if (!row) return null;
  return {
    teamCorrectPoints: row.teamCorrectPoints,
    outcomeCorrectPoints: row.outcomeCorrectPoints,
    advancementPerRoundPoints: row.advancementPerRoundPoints,
    standingRankPoints: row.standingRankPoints,
    groupMatchPoints: row.groupMatchPoints,
  };
}

/** Scoring config of a stage, for a group (its custom points when it uses them) or the global default. */
export async function getStageScoringConfig(stageId: number, group?: { id: number; scoringMode: "default" | "custom" }): Promise<PhaseScoringConfig> {
  const custom = group?.scoringMode === "custom" ? await getGroupPhasePoints(group.id, stageId) : null;
  return custom ?? defaultPickemScoring(await getStageScoringVersion(stageId));
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
  const ctx = await loadStageLeaderboardContext(stageId);
  const defaultConfig = defaultPickemScoring(ctx?.scoringVersion ?? PICKEM_SCORING_VERSION);
  const score = (config: PhaseScoringConfig, restrictToUserIds?: string[]) => (ctx ? scoreStageLeaderboard(ctx, config, restrictToUserIds) : []);

  const scopes: PickemScopedLeaderboard[] = [{ scope: { kind: "global" }, config: defaultConfig, leaderboard: score(defaultConfig) }];
  if (!userId) return scopes;

  const groups = await getMyGroupsForTournament(userId, tournamentId);
  const groupScopes = await Promise.all(
    groups.map(async (g) => ({ g, detail: await getGroupDetail(g.id), custom: g.scoringMode === "custom" ? await getGroupPhasePoints(g.id, stageId) : null }))
  );
  for (const { g, detail, custom } of groupScopes) {
    if (!detail) continue;
    const config = custom ?? defaultConfig;
    scopes.push({ scope: { kind: "group", groupId: g.id, groupName: g.name }, config, leaderboard: score(config, detail.members.map((m) => m.userId)) });
  }
  return scopes;
}
