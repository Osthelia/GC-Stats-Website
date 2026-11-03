/**
 * GC-Stats - types
 *
 * Contract of a tweet provider, so the third party service can be swapped without touching the rest.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { XSignalMedia } from "@gc-stats/db";

export type ProviderTweet = {
  id: string;
  url: string;
  text: string;
  media: XSignalMedia[];
  tweetedAt: Date;
  isRetweet: boolean;
  isReply: boolean;
};

export type TweetPage = { tweets: ProviderTweet[]; nextCursor: string | null };

/** Which tweets to read: original tweets of one account posted since a date. */
export type TweetQuery = { handle: string; since: Date };

export interface XTweetProvider {
  /** Resolves a handle to the provider's stable user id. */
  resolveUserId(handle: string): Promise<string>;
  /** One page of tweets posted since `query.since` (retweets and replies excluded), newest first. A null cursor starts from the latest tweet. */
  fetchPage(query: TweetQuery, cursor: string | null): Promise<TweetPage>;
}
