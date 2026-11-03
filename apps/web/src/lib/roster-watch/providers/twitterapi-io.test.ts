import { afterEach, describe, expect, it, vi } from "vitest";
import { TwitterApiIoProvider } from "./twitterapi-io";

afterEach(() => vi.unstubAllGlobals());

describe("TwitterApiIoProvider", () => {
  it("waits and retries when rate limited", async () => {
    const page = { tweets: [{ id: "1", createdAt: "2026-06-10T12:00:00Z", text: "hi" }], has_next_page: false };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const delays: number[] = [];

    const result = await new TwitterApiIoProvider("k", async (ms) => void delays.push(ms)).fetchPage({ handle: "team", since: new Date("2026-06-10T00:00:00Z") }, null);

    expect(result.tweets.map((t) => t.id)).toEqual(["1"]);
    expect(delays).toEqual([5000, 2000]);
  });

  it("searches the original tweets of the handle since the given date", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tweets: [], has_next_page: false }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await new TwitterApiIoProvider("k", async () => {}).fetchPage({ handle: "team_gc", since: new Date("2026-06-10T00:00:00Z") }, "abc");

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/twitter/tweet/advanced_search");
    expect(url.searchParams.get("query")).toBe("from:team_gc since_time:1781049600 -filter:retweets -filter:replies");
    expect(url.searchParams.get("cursor")).toBe("abc");
  });

  it("refuses a handle that could inject search operators", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new TwitterApiIoProvider("k", async () => {}).fetchPage({ handle: "team OR from:other", since: new Date() }, null)).rejects.toThrow("Invalid X handle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails on other errors without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new TwitterApiIoProvider("k", async () => {}).fetchPage({ handle: "team", since: new Date() }, null)).rejects.toThrow("401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
