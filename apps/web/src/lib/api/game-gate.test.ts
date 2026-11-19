import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveApiKey = vi.fn();

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@gc-stats/db/client", () => ({ db: {} }));
vi.mock("@gc-stats/db", () => ({ apiRequestLog: {}, GameFeatureUnavailableError: class extends Error {} }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: vi.fn() }));
vi.mock("./v1/auth", () => ({ resolveApiKey: (request: Request) => resolveApiKey(request) }));
vi.mock("./v1/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/public-api/config", () => ({ getPublicApiConfig: vi.fn() }));

import { hiddenGamePathGate, publicGameGate } from "./game-gate";
import { withApiV1 } from "./v1/handler";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("PUBLIC_GAMES", "valorant");
  resolveApiKey.mockReset();
});

describe("publicGameGate", () => {
  it("lets a public game through", () => {
    expect(publicGameGate("valorant")).toBeNull();
  });

  it("answers 404 for a game that is not public", async () => {
    const response = publicGameGate("lol");
    expect(response?.status).toBe(404);
    expect(await response?.json()).toEqual({ error: "Not found" });
  });
});

describe("hiddenGamePathGate", () => {
  const gate = (url: string) => hiddenGamePathGate(new Request(url))?.status ?? null;

  it("refuses a hidden game before the API version, wherever the route sits", () => {
    expect(gate("http://localhost/api/valorant/lol/v2/teams")).toBe(404);
    expect(gate("http://localhost/prefix/api/valorant/lol/v2/teams")).toBe(404);
    expect(gate("http://localhost/api/valorant/lol/v2/teams/")).toBe(404);
    expect(gate("http://localhost/api/valorant/lol/extra/v3/matches")).toBe(404);
  });

  it("checks every segment of a path without an API version (fails closed)", () => {
    expect(gate("http://localhost/api/lol/teams")).toBe(404);
    expect(gate("http://localhost/api/valorant/teams/lol")).toBe(404);
  });

  it("refuses the hidden game when its segment is percent-encoded", () => {
    expect(gate("http://localhost/api/valorant/%6Col/v2/teams")).toBe(404);
  });

  it("lets a public game through", () => {
    expect(gate("http://localhost/api/valorant/valorant/v2/teams")).toBeNull();
    expect(gate("http://localhost/api/valorant/valorant/v2/teams/by-name/lolita")).toBeNull();
  });

  it("lets a name after the API version through even when it is a hidden game's slug", () => {
    expect(gate("http://localhost/api/valorant/valorant/v2/teams/by-name/lol")).toBeNull();
    expect(gate("http://localhost/api/valorant/valorant/v1/players/by-name/%6Col/matches")).toBeNull();
  });

  it("lets the game through once it is public", () => {
    vi.stubEnv("PUBLIC_GAMES", "valorant,lol");
    expect(gate("http://localhost/api/valorant/lol/v2/teams")).toBeNull();
  });

  it("ignores a segment that can't be decoded", () => {
    expect(gate("http://localhost/api/valorant/valorant/v2/teams/by-name/%E0%A4%A")).toBeNull();
    expect(gate("http://localhost/api/valorant/%E0%A4%A/lol/v2/teams")).toBe(404);
  });
});

describe("withApiV1", () => {
  it("answers 404 for a hidden game before the key is checked or the handler runs", async () => {
    const handler = vi.fn();
    const response = await withApiV1(new Request("http://localhost/api/valorant/lol/v2/teams"), "/v2/teams", handler);
    expect(response.status).toBe(404);
    expect(resolveApiKey).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("goes on to the key check for a public game", async () => {
    resolveApiKey.mockResolvedValue(null);
    const response = await withApiV1(new Request("http://localhost/api/valorant/valorant/v2/teams"), "/v2/teams", vi.fn());
    expect(response.status).toBe(401);
  });

  it("answers 404 for a hidden game behind an extra path prefix too", async () => {
    const handler = vi.fn();
    const response = await withApiV1(new Request("http://localhost/mounted/api/valorant/lol/v2/teams"), "/v2/teams", handler);
    expect(response.status).toBe(404);
    expect(resolveApiKey).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
