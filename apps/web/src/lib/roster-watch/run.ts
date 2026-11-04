/**
 * GC-Stats - run
 *
 * One roster watch pass: collect the new tweets of every enabled account,
 * pre-filter them with the rules, classify the rest and retry earlier errors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { XSignalMedia } from "@gc-stats/db";
import { collectAccountTweets } from "./collect";
import { applyRules, DEFAULT_RULES, type RulesConfig } from "./rules";
import { translateToEnglish, type TranslateFn } from "./translate";
import type { ClassifierResult } from "./classifier";
import type { XTweetProvider } from "./providers/types";

export type WatchedAccount = { id: number; teamId: number; teamName: string; xHandle: string; xUserId: string | null; lastSeenTweetId: string | null };

export type NewSignal = {
  tweetId: string;
  accountId: number;
  teamId: number;
  tweetUrl: string;
  text: string;
  media: XSignalMedia[];
  tweetedAt: Date;
  stage: "excluded" | "classified" | "error";
  exclusionRuleId: string | null;
  classification: ClassifierResult | null;
  textEn?: string | null;
};

export type RetrySignal = { id: number; tweetId: string; text: string; media: XSignalMedia[]; teamName: string };

/** Persistence used by the run, implemented on Drizzle in store-db.ts and in memory by the tests. */
export interface RosterWatchStore {
  listEnabledAccounts(): Promise<WatchedAccount[]>;
  existingTweetIds(tweetIds: string[]): Promise<Set<string>>;
  /** No-op when the tweet id is already stored. */
  insertSignal(signal: NewSignal): Promise<void>;
  updateAccount(id: number, patch: { xUserId?: string; lastSeenTweetId?: string | null; lastPolledAt: Date; lastError: string | null }): Promise<void>;
  /** Recent errored signals of enabled accounts, capped. */
  listErroredSignals(): Promise<RetrySignal[]>;
  saveClassification(id: number, classification: ClassifierResult, textEn: string | null): Promise<void>;
}

export type ClassifyFn = (input: { text: string; media: XSignalMedia[]; teamName: string }) => Promise<ClassifierResult>;

export type RunStats = { accounts: number; failedAccounts: number; apiCalls: number; tweets: number; excluded: number; classified: number; errors: number; retried: number };

/** One line preview of a tweet for the logs. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 140)}...` : flat;
}

/** Consecutive classification failures after which the run gives up (bad key, model or outage). */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Only the tweets an admin will read are translated, which keeps the DeepL quota small. */
function translateIfReviewable(translate: TranslateFn, classification: ClassifierResult, text: string): Promise<string | null> {
  return classification.verdict === "not_roster" ? Promise.resolve(null) : translate(text);
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

export async function runRosterWatch(deps: {
  store: RosterWatchStore;
  provider: XTweetProvider;
  classify: ClassifyFn;
  translate?: TranslateFn;
  rules?: RulesConfig;
  now?: Date;
}): Promise<RunStats> {
  const { store, provider, classify, translate = translateToEnglish, rules = DEFAULT_RULES, now = new Date() } = deps;
  const stats: RunStats = { accounts: 0, failedAccounts: 0, apiCalls: 0, tweets: 0, excluded: 0, classified: 0, errors: 0, retried: 0 };

  let consecutiveFailures = 0;
  // Tweets that failed during this pass are not worth a second call right away.
  const failedThisRun = new Set<string>();

  for (const account of await store.listEnabledAccounts()) {
    stats.accounts++;
    let accountErrors = 0;
    try {
      const collected = await collectAccountTweets(provider, account, now);
      stats.apiCalls += collected.apiCalls;
      console.log("[roster-watch] @%s fetched: %d kept, %d skipped, %d API call(s)", account.xHandle, collected.tweets.length, collected.skipped.length, collected.apiCalls);
      for (const { tweet, reason } of collected.skipped) console.log("[roster-watch] @%s #%s skipped (%s) | %s", account.xHandle, tweet.id, reason, preview(tweet.text));
      if (collected.stop) console.log("[roster-watch] @%s stopped paging at #%s (%s)", account.xHandle, collected.stop.tweetId, collected.stop.reason);

      const known = await store.existingTweetIds(collected.tweets.map((tweet) => tweet.id));
      const fresh = collected.tweets.filter((tweet) => !known.has(tweet.id));
      stats.tweets += fresh.length;
      for (const tweet of collected.tweets) if (known.has(tweet.id)) console.log("[roster-watch] @%s #%s already stored, ignored | %s", account.xHandle, tweet.id, preview(tweet.text));

      for (const tweet of fresh) {
        const base = { tweetId: tweet.id, accountId: account.id, teamId: account.teamId, tweetUrl: tweet.url, text: tweet.text, media: tweet.media, tweetedAt: tweet.tweetedAt };
        const decision = applyRules({ text: tweet.text, mediaTypes: tweet.media.map((m) => m.type) }, rules);

        if (decision.excluded) {
          await store.insertSignal({ ...base, stage: "excluded", exclusionRuleId: decision.ruleId, classification: null });
          stats.excluded++;
          console.log("[roster-watch] @%s #%s excluded by rule %s (no LLM call) | %s", account.xHandle, tweet.id, decision.ruleId, preview(tweet.text));
          continue;
        }

        try {
          const classification = await classify({ text: tweet.text, media: tweet.media, teamName: account.teamName });
          const textEn = await translateIfReviewable(translate, classification, tweet.text);
          await store.insertSignal({ ...base, stage: "classified", exclusionRuleId: null, classification, textEn });
          stats.classified++;
          consecutiveFailures = 0;
          console.log(
            "[roster-watch] @%s #%s classified %s/%s players=[%s] tokens=%d/%d | %s | %s",
            account.xHandle,
            tweet.id,
            classification.verdict,
            classification.topic,
            classification.players.join(", "),
            classification.inputTokens,
            classification.outputTokens,
            classification.reason,
            preview(tweet.text),
          );
        } catch (error) {
          console.error("[roster-watch] @%s #%s classification failed, stored as error, retried next run | %s", account.xHandle, tweet.id, preview(tweet.text), error);
          await store.insertSignal({ ...base, stage: "error", exclusionRuleId: null, classification: null });
          stats.errors++;
          accountErrors++;
          failedThisRun.add(tweet.id);
          // The stored error row is retried by the retry pass of a later run (recent tweets only).
          if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) throw new Error(`Classifier failing, run stopped: ${errorMessage(error)}`);
        }
      }

      const warnings = [accountErrors > 0 ? `${accountErrors} classification(s) failed` : null, collected.stop?.reason === "max_pages" ? "page limit reached, older tweets skipped" : null].filter(Boolean);
      await store.updateAccount(account.id, {
        xUserId: collected.userId,
        lastSeenTweetId: collected.newestSeenId ?? account.lastSeenTweetId,
        lastPolledAt: now,
        lastError: warnings.length > 0 ? warnings.join(", ") : null,
      });
    } catch (error) {
      stats.failedAccounts++;
      console.error("[roster-watch] account failed (@%s)", account.xHandle, error);
      await store.updateAccount(account.id, { lastPolledAt: now, lastError: errorMessage(error) });
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break;
    }
  }

  const retryable = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? [] : (await store.listErroredSignals()).filter((signal) => !failedThisRun.has(signal.tweetId));
  for (const signal of retryable) {
    try {
      const classification = await classify({ text: signal.text, media: signal.media, teamName: signal.teamName });
      await store.saveClassification(signal.id, classification, await translateIfReviewable(translate, classification, signal.text));
      stats.retried++;
      consecutiveFailures = 0;
    } catch (error) {
      console.error("[roster-watch] retry failed (signal #%d)", signal.id, error);
      if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break;
    }
  }

  return stats;
}
