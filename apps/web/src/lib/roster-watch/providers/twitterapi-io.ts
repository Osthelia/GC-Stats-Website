/**
 * GC-Stats - twitterapi-io
 *
 * XTweetProvider backed by TwitterAPI.io (unofficial third party, keep it behind the interface).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { XSignalMedia } from "@gc-stats/db";
import type { ProviderTweet, TweetPage, XTweetProvider } from "./types";

const BASE_URL = "https://api.twitterapi.io";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RATE_LIMIT_RETRIES = 5;
const RATE_LIMIT_BASE_DELAY_MS = 5_000;
const MAX_RATE_LIMIT_DELAY_MS = 30_000;

type RawMedia = { type?: string; media_url_https?: string; video_info?: { variants?: { url?: string; content_type?: string; bitrate?: number }[] } };
type RawTweet = {
  id?: string;
  url?: string;
  text?: string;
  createdAt?: string;
  isReply?: boolean;
  retweeted_tweet?: unknown;
  extendedEntities?: { media?: RawMedia[] };
};

function mapMedia(raw: RawMedia[] | undefined): XSignalMedia[] {
  const media: XSignalMedia[] = [];
  for (const item of raw ?? []) {
    if (!item.media_url_https) continue;
    if (item.type === "photo") {
      media.push({ type: "photo", url: item.media_url_https, previewUrl: null });
    } else if (item.type === "video" || item.type === "animated_gif") {
      const mp4 = (item.video_info?.variants ?? []).filter((v) => v.content_type === "video/mp4" && v.url).sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
      media.push({ type: "video", url: mp4?.url ?? item.media_url_https, previewUrl: item.media_url_https });
    }
  }
  return media;
}

function mapTweet(raw: RawTweet): ProviderTweet | null {
  if (!raw.id || !raw.createdAt) return null;
  const tweetedAt = new Date(raw.createdAt);
  if (Number.isNaN(tweetedAt.getTime())) return null;
  return {
    id: raw.id,
    url: raw.url ?? `https://x.com/i/status/${raw.id}`,
    text: raw.text ?? "",
    media: mapMedia(raw.extendedEntities?.media),
    tweetedAt,
    isRetweet: !!raw.retweeted_tweet,
    isReply: !!raw.isReply,
  };
}

export class TwitterApiIoProvider implements XTweetProvider {
  constructor(
    private readonly apiKey: string,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, { headers: { "X-API-Key": this.apiKey }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RATE_LIMIT_BASE_DELAY_MS * (attempt + 1);
        console.warn("[roster-watch] TwitterAPI.io rate limited (%s), retrying in %d ms", path, Math.min(delay, MAX_RATE_LIMIT_DELAY_MS));
        await this.sleep(Math.min(delay, MAX_RATE_LIMIT_DELAY_MS));
        continue;
      }
      if (!response.ok) throw new Error(`TwitterAPI.io ${path} responded ${response.status}`);
      return response.json();
    }
  }

  async resolveUserId(handle: string): Promise<string> {
    const body = (await this.get("/twitter/user/info", { userName: handle })) as { data?: { id?: string } };
    const id = body.data?.id;
    if (!id) throw new Error(`TwitterAPI.io could not resolve @${handle}`);
    return id;
  }

  async fetchPage(userId: string, cursor: string | null): Promise<TweetPage> {
    const params: Record<string, string> = { userId, includeReplies: "false" };
    if (cursor) params.cursor = cursor;
    const body = (await this.get("/twitter/user/last_tweets", params)) as {
      data?: { tweets?: RawTweet[] };
      has_next_page?: boolean;
      next_cursor?: string;
    };
    const tweets = (body.data?.tweets ?? []).map(mapTweet).filter((tweet): tweet is ProviderTweet => tweet !== null);
    return { tweets, nextCursor: body.has_next_page && body.next_cursor ? body.next_cursor : null };
  }
}

/** Null when the key is missing, the job then skips the collection. */
export function createDefaultProvider(): XTweetProvider | null {
  const key = process.env.TWITTERAPI_IO_KEY;
  return key ? new TwitterApiIoProvider(key) : null;
}
