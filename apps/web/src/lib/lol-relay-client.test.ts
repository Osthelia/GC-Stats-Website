import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relayProblem, relayProblemKind } from "./lol-relay-client";

describe("relayProblemKind", () => {
  it("keeps a rate limit, a rejected request and a missing resource apart from an unavailable Riot", () => {
    expect(relayProblemKind({ kind: "rateLimited", retryAfterSeconds: null })).toBe("rateLimited");
    expect(relayProblemKind({ kind: "invalidRequest" })).toBe("invalidRequest");
    expect(relayProblemKind({ kind: "notFound" })).toBe("notFound");
  });

  it("still calls the rest unavailable", () => {
    expect(relayProblemKind({ kind: "riotError", status: 500 })).toBe("riotUnavailable");
    expect(relayProblemKind({ kind: "invalidResponse" })).toBe("riotUnavailable");
  });
});

describe("relayProblem", () => {
  it("carries the seconds Riot asked to wait, rounded up", () => {
    expect(relayProblem({ kind: "rateLimited", retryAfterSeconds: 12.2 })).toEqual({ kind: "rateLimited", retryAfterSeconds: 13 });
  });

  it("has no seconds when Riot gave none", () => {
    expect(relayProblem({ kind: "rateLimited", retryAfterSeconds: null })).toEqual({ kind: "rateLimited" });
    expect(relayProblem({ kind: "relayUnreachable" })).toEqual({ kind: "relayUnreachable" });
  });
});

describe("isLolRelayAvailable", () => {
  const load = async () => (await import("./lol-relay-client")).isLolRelayAvailable;
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RIOT_RELAY_URL", "http://relay.test/");
    vi.stubEnv("RIOT_RELAY_TOKEN", "token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is available when /health says the League side is set up", async () => {
    const fetchMock = answer({ valorant: true, lol: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await load())()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://relay.test/health", expect.objectContaining({ method: "GET" }));
  });

  it("is not available when the League side is not set up, or the answer is not that object", async () => {
    vi.stubGlobal("fetch", answer({ lol: false }));
    expect(await (await load())()).toBe(false);
    vi.resetModules();
    vi.stubGlobal("fetch", answer({ ok: true }));
    expect(await (await load())()).toBe(false);
  });

  it("is not available when the relay errors, cannot be reached or times out", async () => {
    vi.stubGlobal("fetch", answer({ lol: true }, 503));
    expect(await (await load())()).toBe(false);
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connect ECONNREFUSED"); }));
    expect(await (await load())()).toBe(false);
  });

  it("is not available, without asking, when the relay is not configured here", async () => {
    vi.stubEnv("RIOT_RELAY_URL", "");
    const fetchMock = answer({ lol: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await load())()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the answer for a while instead of asking on every call", async () => {
    const fetchMock = answer({ lol: true });
    vi.stubGlobal("fetch", fetchMock);
    const isAvailable = await load();
    await isAvailable();
    await isAvailable();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
