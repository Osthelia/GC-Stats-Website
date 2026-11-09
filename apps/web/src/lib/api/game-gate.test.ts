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

import { publicGameGate } from "./game-gate";
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

describe("withApiV1", () => {
  it("answers 404 for a hidden game before the key is checked or the handler runs", async () => {
    const handler = vi.fn();
    const response = await withApiV1(new Request("http://localhost/api/valorant/lol/v2/teams"), "lol", "/v2/teams", handler);
    expect(response.status).toBe(404);
    expect(resolveApiKey).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("goes on to the key check for a public game", async () => {
    resolveApiKey.mockResolvedValue(null);
    const response = await withApiV1(new Request("http://localhost/api/valorant/valorant/v2/teams"), "valorant", "/v2/teams", vi.fn());
    expect(response.status).toBe(401);
  });
});
