import { afterEach, describe, expect, it, vi } from "vitest";
import { TwitterApiIoProvider } from "./twitterapi-io";

afterEach(() => vi.unstubAllGlobals());

describe("TwitterApiIoProvider", () => {
  it("waits and retries when rate limited", async () => {
    const page = { data: { tweets: [{ id: "1", createdAt: "2026-06-10T12:00:00Z", text: "hi" }] }, has_next_page: false };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const delays: number[] = [];

    const result = await new TwitterApiIoProvider("k", async (ms) => void delays.push(ms)).fetchPage("u1", null);

    expect(result.tweets.map((t) => t.id)).toEqual(["1"]);
    expect(delays).toEqual([5000, 2000]);
  });

  it("fails on other errors without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new TwitterApiIoProvider("k", async () => {}).fetchPage("u1", null)).rejects.toThrow("401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
