/**
 * GC-Stats - collect
 *
 * Pulls the new tweets of one account, newest first, until the last seen tweet (or the first run window) is reached.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ProviderTweet, XTweetProvider } from "./providers/types";

export const FIRST_RUN_WINDOW_DAYS = 7;
const MAX_PAGES_PER_ACCOUNT = 20;

export type SkippedTweet = { tweet: ProviderTweet; reason: "retweet" | "reply" };
export type CollectStop = { reason: "known_tweet" | "outside_window" | "max_pages"; tweetId: string | null };
export type CollectResult = {
  tweets: ProviderTweet[];
  skipped: SkippedTweet[];
  /** Why paging ended, null when the account history ran out. */
  stop: CollectStop | null;
  apiCalls: number;
  userId: string;
  newestSeenId: string | null;
};

const SNOWFLAKE_EPOCH_MS = 1_288_834_974_657n;

/** Tweet ids are snowflakes, the post time is in the bits above the 22 low ones. */
export function tweetIdDate(id: string): Date {
  return new Date(Number((BigInt(id) >> 22n) + SNOWFLAKE_EPOCH_MS));
}

/** Numeric string comparison, tweet ids exceed Number.MAX_SAFE_INTEGER. */
export function isNewerTweetId(id: string, sinceId: string): boolean {
  return BigInt(id) > BigInt(sinceId);
}

/**
 * Walks the pages until it falls back on `lastSeenTweetId` (or the 7 day window on a first run),
 * retweets and replies are dropped (`newestSeenId` still covers them, so they are not paged again). Returned oldest first so the last seen id only advances after a full pass.
 */
export async function collectAccountTweets(
  provider: XTweetProvider,
  account: { xHandle: string; xUserId: string | null; lastSeenTweetId: string | null },
  now: Date = new Date(),
): Promise<CollectResult> {
  let apiCalls = 0;
  let userId = account.xUserId;
  if (!userId) {
    userId = await provider.resolveUserId(account.xHandle);
    apiCalls++;
  }

  const windowStart = new Date(now.getTime() - FIRST_RUN_WINDOW_DAYS * 86_400_000);
  // Asking only for tweets since the last seen one keeps the billed tweets to the new ones (the last seen tweet itself may come back, it stops the walk).
  const since = account.lastSeenTweetId ? tweetIdDate(account.lastSeenTweetId) : windowStart;
  const collected: ProviderTweet[] = [];
  const skipped: SkippedTweet[] = [];
  let stopInfo: CollectStop | null = null;
  let cursor: string | null = null;
  let newestSeenId: string | null = null;

  for (let page = 0; page < MAX_PAGES_PER_ACCOUNT; page++) {
    const result = await provider.fetchPage({ handle: account.xHandle, since }, cursor);
    apiCalls++;

    let reachedKnown = false;
    for (const [index, tweet] of result.tweets.entries()) {
      // A non numeric id cannot be compared (BigInt throws), drop it instead of failing the account.
      if (!/^\d+$/.test(tweet.id)) continue;
      const stop = account.lastSeenTweetId ? !isNewerTweetId(tweet.id, account.lastSeenTweetId) : tweet.tweetedAt < windowStart;
      // A pinned tweet comes first whatever its age, it must not end the walk.
      if (stop && page === 0 && index === 0) continue;
      if (stop) {
        reachedKnown = true;
        stopInfo = { reason: account.lastSeenTweetId ? "known_tweet" : "outside_window", tweetId: tweet.id };
        break;
      }
      if (!newestSeenId || isNewerTweetId(tweet.id, newestSeenId)) newestSeenId = tweet.id;
      if (tweet.isRetweet) skipped.push({ tweet, reason: "retweet" });
      else if (tweet.isReply) skipped.push({ tweet, reason: "reply" });
      else collected.push(tweet);
    }

    if (reachedKnown || !result.nextCursor || result.tweets.length === 0) break;
    if (page === MAX_PAGES_PER_ACCOUNT - 1) stopInfo = { reason: "max_pages", tweetId: null };
    cursor = result.nextCursor;
  }

  collected.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  return { tweets: collected, skipped, stop: stopInfo, apiCalls, userId, newestSeenId };
}
