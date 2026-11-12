import { describe, expect, it, vi } from "vitest";
import { collectAccountTweets } from "./collect";
import { runRosterWatch, type NewSignal, type RosterWatchStore, type WatchedAccount } from "./run";
import type { ProviderTweet, TweetPage, TweetQuery, XTweetProvider } from "./providers/types";
import type { ClassifierResult } from "./classifier";

const NOW = new Date("2026-06-10T12:00:00Z");

function tweet(id: number | string, overrides: Partial<ProviderTweet> = {}): ProviderTweet {
  const numeric = Number(id);
  return { id: String(id), url: `https://x.com/i/status/${id}`, text: `tweet number ${id} posted by the team today`, media: [], tweetedAt: new Date(NOW.getTime() - (1000 - numeric) * 60_000), isRetweet: false, isReply: false, ...overrides };
}

/** Serves tweets newest first in pages of `size`, counting the calls. */
function fakeProvider(tweets: ProviderTweet[], size: number): XTweetProvider & { calls: number; queries: TweetQuery[] } {
  const sorted = [...tweets].sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1));
  const provider = {
    calls: 0,
    queries: [] as TweetQuery[],
    resolveUserId: async () => "u1",
    fetchPage: async (query: TweetQuery, cursor: string | null): Promise<TweetPage> => {
      provider.calls++;
      provider.queries.push(query);
      const start = cursor ? Number(cursor) : 0;
      const end = start + size;
      return { tweets: sorted.slice(start, end), nextCursor: end < sorted.length ? String(end) : null };
    },
  };
  return provider;
}

const classification: ClassifierResult = { verdict: "unsure", topic: "content", players: [], reason: "r", model: "m", inputTokens: 1, outputTokens: 1 };

function memoryStore(account: Partial<WatchedAccount> = {}) {
  const signals = new Map<string, NewSignal>();
  const store: RosterWatchStore & { signals: Map<string, NewSignal>; account: WatchedAccount; lastError: string | null } = {
    signals,
    account: { id: 1, teamId: 1, teamName: "Team", xHandle: "team", xUserId: null, lastSeenTweetId: null, ...account },
    lastError: null,
    listEnabledAccounts: async () => [store.account],
    existingTweetIds: async (ids) => new Set(ids.filter((id) => signals.has(id))),
    insertSignal: async (signal) => void (signals.has(signal.tweetId) || signals.set(signal.tweetId, signal)),
    updateAccount: async (_id, patch) => {
      if (patch.xUserId) store.account.xUserId = patch.xUserId;
      if (patch.lastSeenTweetId !== undefined) store.account.lastSeenTweetId = patch.lastSeenTweetId;
      store.lastError = patch.lastError;
    },
    listErroredSignals: async () => [],
    saveClassification: async () => {},
  };
  return store;
}

describe("collectAccountTweets", () => {
  it("pages until it falls back on the last seen tweet", async () => {
    const provider = fakeProvider([1, 2, 3, 4, 5, 6].map((id) => tweet(id)), 2);
    const result = await collectAccountTweets(provider, { xHandle: "t", xUserId: "u1", lastSeenTweetId: "3" }, NOW);
    expect(result.tweets.map((t) => t.id)).toEqual(["4", "5", "6"]);
    expect(provider.calls).toBe(2);
  });

  it("asks only for the tweets since the last seen one, or the 7 day window on a first run", async () => {
    const known = (BigInt(Date.UTC(2026, 5, 10)) - 1_288_834_974_657n) << 22n;
    const seen = fakeProvider([], 20);
    await collectAccountTweets(seen, { xHandle: "t", xUserId: "u1", lastSeenTweetId: String(known) }, NOW);
    expect(seen.queries[0]).toEqual({ handle: "t", since: new Date(Date.UTC(2026, 5, 10)) });

    const first = fakeProvider([], 20);
    await collectAccountTweets(first, { xHandle: "t", xUserId: "u1", lastSeenTweetId: null }, NOW);
    expect(first.queries[0]?.since).toEqual(new Date(NOW.getTime() - 7 * 86_400_000));
  });

  it("limits the first run to the last 7 days", async () => {
    const old = tweet(1, { tweetedAt: new Date(NOW.getTime() - 8 * 86_400_000) });
    const recent = tweet(2, { tweetedAt: new Date(NOW.getTime() - 86_400_000) });
    const result = await collectAccountTweets(fakeProvider([old, recent], 10), { xHandle: "t", xUserId: "u1", lastSeenTweetId: null }, NOW);
    expect(result.tweets.map((t) => t.id)).toEqual(["2"]);
  });

  it("drops retweets and replies but still advances the last seen id", async () => {
    const provider = fakeProvider([tweet(1), tweet(2, { isRetweet: true }), tweet(3, { isReply: true })], 10);
    const result = await collectAccountTweets(provider, { xHandle: "t", xUserId: "u1", lastSeenTweetId: null }, NOW);
    expect(result.tweets.map((t) => t.id)).toEqual(["1"]);
    expect(result.newestSeenId).toBe("3");
  });

  it("compares ids beyond Number.MAX_SAFE_INTEGER", async () => {
    const base = 1_900_000_000_000_000_000n;
    const big = (n: bigint) => tweet(String(base + n), { tweetedAt: NOW });
    const provider = fakeProvider([big(1n), big(2n), big(3n)], 10);
    const result = await collectAccountTweets(provider, { xHandle: "t", xUserId: "u1", lastSeenTweetId: String(base + 1n) }, NOW);
    expect(result.tweets.map((t) => t.id)).toEqual([String(base + 2n), String(base + 3n)]);
  });
});

describe("runRosterWatch", () => {
  it("stores excluded and classified tweets, and a re-run neither duplicates nor calls the LLM again", async () => {
    const store = memoryStore();
    const provider = fakeProvider([tweet(1, { text: "Matchday today" }), tweet(2, { text: "Something big is coming to the team soon" })], 10);
    const classify = vi.fn().mockResolvedValue(classification);

    const first = await runRosterWatch({ store, provider, classify, now: NOW });
    expect(first).toMatchObject({ tweets: 2, excluded: 1, classified: 1 });
    expect(store.signals.get("1")).toMatchObject({ stage: "excluded", exclusionRuleId: "matchday" });
    expect(store.signals.get("2")).toMatchObject({ stage: "classified" });
    expect(store.account.lastSeenTweetId).toBe("2");

    store.account.lastSeenTweetId = null;
    const second = await runRosterWatch({ store, provider, classify, now: NOW });
    expect(second.tweets).toBe(0);
    expect(store.signals.size).toBe(2);
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it("stores a classification failure as an error", async () => {
    const store = memoryStore();
    const stats = await runRosterWatch({ store, provider: fakeProvider([tweet(1)], 10), classify: vi.fn().mockRejectedValue(new Error("boom")), now: NOW });
    expect(stats.errors).toBe(1);
    expect(store.signals.get("1")).toMatchObject({ stage: "error", classification: null });
  });

  it("records an account failure and continues", async () => {
    const store = memoryStore();
    const provider: XTweetProvider = {
      resolveUserId: async () => {
        throw new Error("no such user");
      },
      fetchPage: async () => ({ tweets: [], nextCursor: null }),
    };
    const stats = await runRosterWatch({ store, provider, classify: vi.fn(), now: NOW });
    expect(stats.failedAccounts).toBe(1);
    expect(store.lastError).toBe("no such user");
  });
});
