/**
 * GC-Stats - store-db
 *
 * Drizzle implementation of the roster watch store.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { teams, xMonitoredAccounts, xRosterSignals } from "@gc-stats/db";
import type { ClassifierResult } from "./classifier";
import type { NewSignal, RosterWatchStore } from "./run";

function classificationColumns(c: ClassifierResult) {
  return {
    verdict: c.verdict,
    topic: c.topic,
    players: c.players,
    llmReason: c.reason,
    llmModel: c.model,
    llmInputTokens: c.inputTokens,
    llmOutputTokens: c.outputTokens,
  };
}

const RETRY_MAX_AGE_DAYS = 7;
const RETRY_LIMIT = 50;

export const dbRosterWatchStore: RosterWatchStore = {
  async listEnabledAccounts() {
    return db
      .select({
        id: xMonitoredAccounts.id,
        teamId: xMonitoredAccounts.teamId,
        teamName: teams.name,
        xHandle: xMonitoredAccounts.xHandle,
        xUserId: xMonitoredAccounts.xUserId,
        lastSeenTweetId: xMonitoredAccounts.lastSeenTweetId,
      })
      .from(xMonitoredAccounts)
      .innerJoin(teams, eq(teams.id, xMonitoredAccounts.teamId))
      .where(eq(xMonitoredAccounts.enabled, true));
  },

  async existingTweetIds(tweetIds) {
    if (tweetIds.length === 0) return new Set();
    const rows = await db.select({ tweetId: xRosterSignals.tweetId }).from(xRosterSignals).where(inArray(xRosterSignals.tweetId, tweetIds));
    return new Set(rows.map((row) => row.tweetId));
  },

  async insertSignal(signal: NewSignal) {
    await db
      .insert(xRosterSignals)
      .values({
        tweetId: signal.tweetId,
        accountId: signal.accountId,
        teamId: signal.teamId,
        tweetUrl: signal.tweetUrl,
        text: signal.text,
        media: signal.media,
        tweetedAt: signal.tweetedAt,
        stage: signal.stage,
        exclusionRuleId: signal.exclusionRuleId,
        textEn: signal.textEn ?? null,
        ...(signal.classification ? classificationColumns(signal.classification) : {}),
      })
      .onConflictDoNothing({ target: xRosterSignals.tweetId });
  },

  async updateAccount(id, patch) {
    await db.update(xMonitoredAccounts).set(patch).where(eq(xMonitoredAccounts.id, id));
  },

  async listErroredSignals() {
    return db
      .select({ id: xRosterSignals.id, tweetId: xRosterSignals.tweetId, text: xRosterSignals.text, media: xRosterSignals.media, teamName: teams.name })
      .from(xRosterSignals)
      .innerJoin(teams, eq(teams.id, xRosterSignals.teamId))
      .innerJoin(xMonitoredAccounts, eq(xMonitoredAccounts.id, xRosterSignals.accountId))
      .where(
        and(
          eq(xRosterSignals.stage, "error"),
          eq(xMonitoredAccounts.enabled, true),
          gte(xRosterSignals.tweetedAt, new Date(Date.now() - RETRY_MAX_AGE_DAYS * 86_400_000)),
        ),
      )
      .orderBy(desc(xRosterSignals.tweetedAt))
      .limit(RETRY_LIMIT);
  },

  async saveClassification(id, classification, textEn) {
    await db
      .update(xRosterSignals)
      .set({ stage: "classified", ...classificationColumns(classification), textEn, updatedAt: new Date() })
      .where(eq(xRosterSignals.id, id));
  },
};
