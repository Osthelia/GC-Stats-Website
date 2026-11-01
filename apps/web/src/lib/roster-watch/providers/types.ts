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

export interface XTweetProvider {
  /** Resolves a handle to the provider's stable user id. */
  resolveUserId(handle: string): Promise<string>;
  /** One page of tweets, newest first. A null cursor starts from the latest tweet. */
  fetchPage(userId: string, cursor: string | null): Promise<TweetPage>;
}
