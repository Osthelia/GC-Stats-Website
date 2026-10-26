/**
 * GC-Stats - veto-service
 *
 * Live veto of a match: team links, session state, team actions and
 * timeouts. Every change runs in one transaction on a locked session row,
 * and is written to match_vetos as it happens.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, matches, matchVetos, matchVetoSessions, maps, tournamentVetoSettings, tournaments } from "@gc-stats/db";
import { matchTag } from "@/lib/cache-tags";
import { VALORANT_MAP_POOL } from "@/lib/valorant-maps";
import { syncPlayedMapsFromVeto } from "@/lib/match-veto-maps";
import { postDiscordWebhook } from "@/lib/discord-webhook";
import { VETO_GRACE_SECONDS, buildVetoSteps, computeVetoProgress, requiredPoolSize, stepEntrantId, validateVetoAction, type VetoActionInput, type VetoProgress, type VetoRecord, type VetoSide, type VetoStep } from "./engine";

export type VetoStatus = "waiting" | "choosing" | "running" | "done";
export type FirstMoverMode = "coin_toss" | "coin_toss_winner" | "advantage" | "predefined";

export type VetoSettings = {
  firstMoverMode: FirstMoverMode;
  advantageEntrantId: number | null;
  predefinedSlot: "a" | "b";
  actionTimeoutSeconds: number;
  mapPool: string[];
  mapPoolPatch: string | null;
};

export const DEFAULT_VETO_SETTINGS: VetoSettings = { firstMoverMode: "coin_toss", advantageEntrantId: null, predefinedSlot: "a", actionTimeoutSeconds: 60, mapPool: [], mapPoolPatch: null };

/** Secret of a team's veto link, 192 bits. */
function newVetoToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function getVetoSettings(tournamentId: number): Promise<VetoSettings> {
  const [row] = await db.select().from(tournamentVetoSettings).where(eq(tournamentVetoSettings.tournamentId, tournamentId)).limit(1);
  if (!row) return DEFAULT_VETO_SETTINGS;
  return {
    firstMoverMode: row.firstMoverMode as FirstMoverMode,
    advantageEntrantId: row.advantageEntrantId,
    predefinedSlot: row.predefinedSlot === "b" ? "b" : "a",
    actionTimeoutSeconds: row.actionTimeoutSeconds,
    mapPool: row.mapPool,
    mapPoolPatch: row.mapPoolPatch,
  };
}

/** Gives a token to every team of the tournament that has none yet. */
export async function ensureVetoTokens(tournamentId: number): Promise<void> {
  const missing = await db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.tournamentId, tournamentId), eq(entrants.kind, "team"), sql`${entrants.vetoToken} is null`));
  for (const row of missing) {
    await db.update(entrants).set({ vetoToken: newVetoToken() }).where(and(eq(entrants.id, row.id), sql`${entrants.vetoToken} is null`));
  }
}

export async function regenerateVetoToken(entrantId: number): Promise<string> {
  const token = newVetoToken();
  await db.update(entrants).set({ vetoToken: token }).where(eq(entrants.id, entrantId));
  return token;
}

/** Maps most played on a patch, to build a pool from the patch alone. */
export async function mapPoolFromPatch(patch: string): Promise<string[]> {
  const rows = await db
    .select({ mapName: maps.mapName, played: sql<number>`count(*)::int` })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .where(and(eq(matches.patch, patch), inArray(maps.mapName, [...VALORANT_MAP_POOL])))
    .groupBy(maps.mapName)
    .orderBy(desc(sql`count(*)`), asc(maps.mapName))
    .limit(7);
  return rows.map((r) => r.mapName ?? "").filter(Boolean).sort();
}

/** Match pool, else tournament pool, else the maps of the tournament patch. */
export async function resolveMapPool(settings: VetoSettings, matchPool: string[]): Promise<string[]> {
  if (matchPool.length > 0) return matchPool;
  if (settings.mapPool.length > 0) return settings.mapPool;
  return settings.mapPoolPatch ? mapPoolFromPatch(settings.mapPoolPatch) : [];
}

export type TeamContext = { entrantId: number; tournamentId: number; tournamentName: string };

/** The team behind a veto link, only while the tournament has the veto enabled. */
export async function getTeamContext(token: string): Promise<TeamContext | null> {
  if (!token || token.length > 64) return null;
  const [row] = await db
    .select({ entrantId: entrants.id, tournamentId: entrants.tournamentId, tournamentName: tournaments.name })
    .from(entrants)
    .innerJoin(tournaments, eq(tournaments.id, entrants.tournamentId))
    .where(and(eq(entrants.vetoToken, token), eq(tournaments.vetoEnabled, true)))
    .limit(1);
  return row ?? null;
}

export type TeamMatchRow = { id: number; status: "pending" | "live" | "completed"; scheduledAt: Date | null; entrantAId: number; entrantBId: number; opponentName: string };

/** Matches of the team with both teams known, not finished first (soonest first), then the finished ones. */
export async function listTeamMatches(entrantId: number): Promise<TeamMatchRow[]> {
  const rows = await db
    .select({ id: matches.id, status: matches.status, scheduledAt: matches.scheduledAt, entrantAId: matches.entrantAId, entrantBId: matches.entrantBId })
    .from(matches)
    .where(and(or(eq(matches.entrantAId, entrantId), eq(matches.entrantBId, entrantId)), isNotNull(matches.entrantAId), isNotNull(matches.entrantBId)));
  const known = rows.filter((r): r is typeof r & { entrantAId: number; entrantBId: number } => r.entrantAId !== null && r.entrantBId !== null);
  const opponentIds = known.map((r) => (r.entrantAId === entrantId ? r.entrantBId : r.entrantAId));
  const names = opponentIds.length > 0 ? await db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, opponentIds)) : [];
  const nameById = new Map(names.map((n) => [n.id, n.displayName]));

  const rank = (m: { status: string; scheduledAt: Date | null; id: number }) => [m.status === "completed" ? 1 : 0, m.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER, m.id] as const;
  return known
    .map((r) => ({ ...r, opponentName: nameById.get(r.entrantAId === entrantId ? r.entrantBId : r.entrantAId) ?? "TBD" }))
    .sort((x, y) => {
      const a = rank(x);
      const b = rank(y);
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    });
}

export type VetoAction =
  | { type: "ready"; ready: boolean }
  | { type: "chooseFirst"; who: "self" | "opponent" }
  | { type: "play"; action: VetoActionInput }
  | { type: "finished" };

export type VetoActionError = "notFound" | "notAllowed" | "wrongPhase" | "notYourTurn" | "wrongStep" | "mapUnavailable" | "invalidSide" | "noStep" | "poolInvalid" | "alreadyNotified" | "matchCompleted";

export type VetoPublicState = {
  version: number;
  status: VetoStatus;
  matchId: number;
  bestOf: number;
  entrantA: { id: number; name: string };
  entrantB: { id: number; name: string };
  readyA: boolean;
  readyB: boolean;
  firstEntrantId: number | null;
  /** Team that has to choose who vetoes first, while `status` is "choosing". */
  chooserEntrantId: number | null;
  pool: string[];
  records: VetoRecord[];
  steps: { kind: VetoStep["kind"]; entrantId: number | null; mapIndex: number | null }[];
  stepIndex: number | null;
  stepStartedAt: string | null;
  timeoutSeconds: number;
  notified: boolean;
  poolError: boolean;
};

type Ctx = {
  matchId: number;
  bestOf: number;
  entrantAId: number;
  entrantBId: number;
  settings: VetoSettings;
  status: VetoStatus;
  readyA: boolean;
  readyB: boolean;
  coinTossWinnerId: number | null;
  firstEntrantId: number | null;
  stepStartedAt: Date | null;
  staffNotifiedAt: Date | null;
  version: number;
  matchPool: string[];
  pool: string[];
  records: VetoRecord[];
  dirty: boolean;
  recordsDirty: boolean;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function secondEntrant(ctx: Ctx): number | null {
  if (ctx.firstEntrantId === null) return null;
  return ctx.firstEntrantId === ctx.entrantAId ? ctx.entrantBId : ctx.entrantAId;
}

function chooserOf(ctx: Ctx): number | null {
  if (ctx.settings.firstMoverMode === "advantage") return ctx.settings.advantageEntrantId;
  if (ctx.settings.firstMoverMode === "coin_toss_winner") return ctx.coinTossWinnerId;
  return null;
}

function progressOf(ctx: Ctx): VetoProgress {
  return computeVetoProgress(ctx.bestOf, ctx.pool, ctx.records);
}

function startRunning(ctx: Ctx, firstEntrantId: number) {
  ctx.firstEntrantId = firstEntrantId;
  ctx.status = "running";
  ctx.stepStartedAt = new Date();
  ctx.dirty = true;
  addDeciderIfDue(ctx);
}

/** Once every ban and pick is done, the last map is the decider. */
function addDeciderIfDue(ctx: Ctx) {
  const progress = progressOf(ctx);
  if (!progress.deciderToAdd || ctx.firstEntrantId === null) return;
  ctx.records.push({ entrantId: ctx.firstEntrantId, mapName: progress.deciderToAdd, type: "decider", side: null, sidePickedByEntrantId: null });
  ctx.recordsDirty = true;
  ctx.dirty = true;
}

function beginVeto(ctx: Ctx) {
  const { firstMoverMode, advantageEntrantId, predefinedSlot } = ctx.settings;
  const both = [ctx.entrantAId, ctx.entrantBId];
  const toss = both[Math.random() < 0.5 ? 0 : 1] as number;
  if (firstMoverMode === "predefined") return startRunning(ctx, predefinedSlot === "a" ? ctx.entrantAId : ctx.entrantBId);
  if (firstMoverMode === "advantage" && advantageEntrantId !== null && both.includes(advantageEntrantId)) {
    ctx.status = "choosing";
    ctx.dirty = true;
    return;
  }
  ctx.coinTossWinnerId = toss;
  if (firstMoverMode === "coin_toss_winner") {
    ctx.status = "choosing";
    ctx.dirty = true;
    return;
  }
  startRunning(ctx, toss);
}

function finishIfComplete(ctx: Ctx) {
  if (ctx.status !== "running") return;
  if (progressOf(ctx).step) return;
  ctx.status = "done";
  ctx.stepStartedAt = null;
  ctx.dirty = true;
  ctx.recordsDirty = true;
}

/** Applies a ban/pick/side for the team the waiting step belongs to. */
function applyPlay(ctx: Ctx, progress: VetoProgress, action: VetoActionInput) {
  const step = progress.step as VetoStep;
  const second = secondEntrant(ctx) as number;
  const actor = stepEntrantId(step, ctx.firstEntrantId as number, second);
  if (action.kind === "side") {
    const played = ctx.records.filter((r) => r.type !== "ban");
    const target = played[(step as Extract<VetoStep, { kind: "side" }>).mapIndex];
    if (target) {
      target.side = action.side;
      target.sidePickedByEntrantId = actor;
    }
  } else {
    ctx.records.push({ entrantId: actor, mapName: action.mapName, type: action.kind, side: null, sidePickedByEntrantId: null });
    addDeciderIfDue(ctx);
  }
  ctx.stepStartedAt = new Date();
  ctx.dirty = true;
  ctx.recordsDirty = true;
  finishIfComplete(ctx);
}

/** A team that ran out of time gets a random legal action. */
function applyTimeouts(ctx: Ctx, now: Date) {
  const timeout = ctx.settings.actionTimeoutSeconds;
  if (timeout <= 0) return;
  const limitMs = (timeout + VETO_GRACE_SECONDS) * 1000;
  for (let guard = 0; guard < 20 && ctx.status === "running" && ctx.stepStartedAt; guard++) {
    if (now.getTime() - ctx.stepStartedAt.getTime() < limitMs) return;
    const progress = progressOf(ctx);
    if (!progress.step) return finishIfComplete(ctx);
    if (progress.step.kind !== "side" && progress.remainingMaps.length === 0) return;
    const sides: VetoSide[] = ["atk", "def"];
    const action: VetoActionInput =
      progress.step.kind === "side"
        ? { kind: "side", side: sides[Math.random() < 0.5 ? 0 : 1] as VetoSide }
        : { kind: progress.step.kind, mapName: progress.remainingMaps[Math.floor(Math.random() * progress.remainingMaps.length)] as string };
    const startedAt = ctx.stepStartedAt;
    applyPlay(ctx, progress, action);
    // Next countdown starts when the previous one ended, so a long absence plays out step by step.
    if (ctx.status === "running") ctx.stepStartedAt = new Date(startedAt.getTime() + limitMs);
  }
}

async function loadCtx(tx: Tx, matchId: number): Promise<Ctx | null> {
  const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match || match.entrantAId === null || match.entrantBId === null) return null;
  await tx.insert(matchVetoSessions).values({ matchId }).onConflictDoNothing();
  const [session] = await tx.select().from(matchVetoSessions).where(eq(matchVetoSessions.matchId, matchId)).for("update").limit(1);
  if (!session) return null;
  const [entrantRow] = await tx.select({ tournamentId: entrants.tournamentId }).from(entrants).where(eq(entrants.id, match.entrantAId)).limit(1);
  const [settingsRow] = entrantRow ? await tx.select().from(tournamentVetoSettings).where(eq(tournamentVetoSettings.tournamentId, entrantRow.tournamentId)).limit(1) : [];
  const settings: VetoSettings = settingsRow
    ? { firstMoverMode: settingsRow.firstMoverMode as FirstMoverMode, advantageEntrantId: settingsRow.advantageEntrantId, predefinedSlot: settingsRow.predefinedSlot === "b" ? "b" : "a", actionTimeoutSeconds: settingsRow.actionTimeoutSeconds, mapPool: settingsRow.mapPool, mapPoolPatch: settingsRow.mapPoolPatch }
    : DEFAULT_VETO_SETTINGS;
  const records = (await tx.select().from(matchVetos).where(eq(matchVetos.matchId, matchId)).orderBy(asc(matchVetos.order))).map(
    (r): VetoRecord => ({ entrantId: r.entrantId, mapName: r.mapName, type: r.type as VetoRecord["type"], side: (r.side as VetoSide | null) ?? null, sidePickedByEntrantId: r.sidePickedByEntrantId })
  );
  const pool = session.mapPool.length > 0 ? session.mapPool : settings.mapPool.length > 0 ? settings.mapPool : settings.mapPoolPatch ? await mapPoolFromPatch(settings.mapPoolPatch) : [];
  return {
    matchId,
    bestOf: match.bestOf,
    entrantAId: match.entrantAId,
    entrantBId: match.entrantBId,
    settings,
    status: session.status as VetoStatus,
    readyA: session.readyA,
    readyB: session.readyB,
    coinTossWinnerId: session.coinTossWinnerId,
    firstEntrantId: session.firstEntrantId,
    stepStartedAt: session.stepStartedAt,
    staffNotifiedAt: session.staffNotifiedAt,
    version: session.version,
    matchPool: session.mapPool,
    pool,
    records,
    dirty: false,
    recordsDirty: false,
  };
}

async function persistCtx(tx: Tx, ctx: Ctx) {
  if (!ctx.dirty && !ctx.recordsDirty) return;
  if (ctx.recordsDirty) {
    await tx.delete(matchVetos).where(eq(matchVetos.matchId, ctx.matchId));
    if (ctx.records.length > 0) {
      await tx.insert(matchVetos).values(ctx.records.map((r, index) => ({ matchId: ctx.matchId, entrantId: r.entrantId, mapName: r.mapName, type: r.type, order: index + 1, side: r.side, sidePickedByEntrantId: r.sidePickedByEntrantId })));
    }
    if (ctx.status === "done") await syncPlayedMapsFromVeto(tx, ctx.matchId, ctx.records);
  }
  ctx.version += 1;
  await tx
    .update(matchVetoSessions)
    .set({ status: ctx.status, readyA: ctx.readyA, readyB: ctx.readyB, coinTossWinnerId: ctx.coinTossWinnerId, firstEntrantId: ctx.firstEntrantId, stepStartedAt: ctx.stepStartedAt, staffNotifiedAt: ctx.staffNotifiedAt, version: ctx.version, updatedAt: new Date() })
    .where(eq(matchVetoSessions.matchId, ctx.matchId));
}

function toPublicState(ctx: Ctx, names: { a: string; b: string }): VetoPublicState {
  const progress = progressOf(ctx);
  const second = secondEntrant(ctx);
  const steps = buildVetoSteps(ctx.bestOf).map((s) => ({
    kind: s.kind,
    entrantId: ctx.firstEntrantId !== null && second !== null ? stepEntrantId(s, ctx.firstEntrantId, second) : null,
    mapIndex: s.kind === "side" ? s.mapIndex : null,
  }));
  return {
    version: ctx.version,
    status: ctx.status,
    matchId: ctx.matchId,
    bestOf: ctx.bestOf,
    entrantA: { id: ctx.entrantAId, name: names.a },
    entrantB: { id: ctx.entrantBId, name: names.b },
    readyA: ctx.readyA,
    readyB: ctx.readyB,
    firstEntrantId: ctx.firstEntrantId,
    chooserEntrantId: ctx.status === "choosing" ? chooserOf(ctx) : null,
    pool: ctx.pool,
    records: ctx.records,
    steps,
    stepIndex: progress.stepIndex,
    stepStartedAt: ctx.status === "running" ? (ctx.stepStartedAt?.toISOString() ?? null) : null,
    timeoutSeconds: ctx.settings.actionTimeoutSeconds,
    notified: ctx.staffNotifiedAt !== null,
    poolError: ctx.pool.length !== requiredPoolSize(ctx.bestOf),
  };
}

async function entrantNames(a: number, b: number): Promise<{ a: string; b: string }> {
  const rows = await db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, [a, b]));
  return { a: rows.find((r) => r.id === a)?.displayName ?? "TBD", b: rows.find((r) => r.id === b)?.displayName ?? "TBD" };
}

/** Current state of a match veto, after applying the timeouts that elapsed. */
export async function getVetoState(matchId: number): Promise<VetoPublicState | null> {
  const result = await db.transaction(async (tx) => {
    const ctx = await loadCtx(tx, matchId);
    if (!ctx) return null;
    // A finished match keeps its maps, no timeout may replay its veto.
    const [match] = await tx.select({ status: matches.status }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (match?.status !== "completed") {
      applyTimeouts(ctx, new Date());
      await persistCtx(tx, ctx);
    }
    return ctx;
  });
  if (!result) return null;
  if (result.recordsDirty) revalidateTag(matchTag(matchId), { expire: 0 });
  return toPublicState(result, await entrantNames(result.entrantAId, result.entrantBId));
}

export type VetoActionResult = { ok: true; state: VetoPublicState } | { ok: false; error: VetoActionError };

/** Runs a team action on a match, checking it belongs to the team and fits the current phase. */
export async function performVetoAction(viewerEntrantId: number, matchId: number, action: VetoAction): Promise<VetoActionResult> {
  let notifyStaff = false;
  const outcome = await db.transaction(async (tx): Promise<{ error: VetoActionError } | { ctx: Ctx }> => {
    const ctx = await loadCtx(tx, matchId);
    if (!ctx) return { error: "notFound" };
    if (viewerEntrantId !== ctx.entrantAId && viewerEntrantId !== ctx.entrantBId) return { error: "notAllowed" };
    const [match] = await tx.select({ status: matches.status }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (match?.status === "completed") return { error: "matchCompleted" };
    applyTimeouts(ctx, new Date());

    if (action.type === "ready") {
      if (ctx.status !== "waiting") return { error: "wrongPhase" };
      if (ctx.pool.length !== requiredPoolSize(ctx.bestOf)) return { error: "poolInvalid" };
      if (viewerEntrantId === ctx.entrantAId) ctx.readyA = action.ready;
      else ctx.readyB = action.ready;
      ctx.dirty = true;
      if (ctx.readyA && ctx.readyB) beginVeto(ctx);
    } else if (action.type === "chooseFirst") {
      if (ctx.status !== "choosing") return { error: "wrongPhase" };
      if (chooserOf(ctx) !== viewerEntrantId) return { error: "notYourTurn" };
      const opponent = viewerEntrantId === ctx.entrantAId ? ctx.entrantBId : ctx.entrantAId;
      startRunning(ctx, action.who === "self" ? viewerEntrantId : opponent);
    } else if (action.type === "play") {
      if (ctx.status !== "running") return { error: "wrongPhase" };
      const progress = progressOf(ctx);
      const invalid = validateVetoAction(progress, action.action);
      if (invalid) return { error: invalid };
      const second = secondEntrant(ctx) as number;
      if (stepEntrantId(progress.step as VetoStep, ctx.firstEntrantId as number, second) !== viewerEntrantId) return { error: "notYourTurn" };
      applyPlay(ctx, progress, action.action);
    } else {
      if (ctx.status !== "done") return { error: "wrongPhase" };
      if (ctx.staffNotifiedAt) return { error: "alreadyNotified" };
      ctx.staffNotifiedAt = new Date();
      ctx.dirty = true;
      notifyStaff = true;
    }
    await persistCtx(tx, ctx);
    return { ctx };
  });

  if ("error" in outcome) return { ok: false, error: outcome.error };
  const { ctx } = outcome;
  if (ctx.recordsDirty) revalidateTag(matchTag(matchId), { expire: 0 });
  const names = await entrantNames(ctx.entrantAId, ctx.entrantBId);
  if (notifyStaff) await notifyGameFinished(matchId, names);
  return { ok: true, state: toPublicState(ctx, names) };
}

async function notifyGameFinished(matchId: number, names: { a: string; b: string }) {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await postDiscordWebhook(process.env.DISCORD_MATCH_LIVE_WEBHOOK_URL, `🏁 **Game finished** : ${names.a} vs ${names.b}\n${base}/match/${matchId}`);
}

/** Resets a match veto (admin or organizer), keeping its pool override. The played maps of the veto are removed too. */
export async function resetVeto(matchId: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Same lock order as the team actions, so a reset never deadlocks with one.
    await tx.select({ matchId: matchVetoSessions.matchId }).from(matchVetoSessions).where(eq(matchVetoSessions.matchId, matchId)).for("update");
    await tx.delete(matchVetos).where(eq(matchVetos.matchId, matchId));
    await syncPlayedMapsFromVeto(tx, matchId, []);
    await tx
      .update(matchVetoSessions)
      .set({ status: "waiting", readyA: false, readyB: false, coinTossWinnerId: null, firstEntrantId: null, stepStartedAt: null, staffNotifiedAt: null, version: sql`${matchVetoSessions.version} + 1`, updatedAt: new Date() })
      .where(eq(matchVetoSessions.matchId, matchId));
  });
  revalidateTag(matchTag(matchId), { expire: 0 });
}
