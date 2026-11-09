import { describe, expect, it } from "vitest";
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
