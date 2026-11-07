import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyTweet, imageUrlsForVision, normalizeToolInput } from "./classifier";
import { enforceInvariants } from "./constants";

describe("enforceInvariants", () => {
  it("forces roster for roster topics and staff changes", () => {
    for (const topic of ["roster_join", "roster_leave", "roster_bench", "staff_change"] as const) {
      expect(enforceInvariants("not_roster", topic)).toBe("roster");
      expect(enforceInvariants("unsure", topic)).toBe("roster");
    }
  });

  it("forces unsure for other and tryouts", () => {
    expect(enforceInvariants("not_roster", "other")).toBe("unsure");
    expect(enforceInvariants("roster", "other")).toBe("unsure");
    expect(enforceInvariants("not_roster", "tryouts")).toBe("unsure");
  });

  it("keeps not_roster only with a specific non roster topic", () => {
    expect(enforceInvariants("not_roster", "match_result")).toBe("not_roster");
    expect(enforceInvariants("unsure", "sponsor")).toBe("unsure");
  });
});

describe("normalizeToolInput", () => {
  it("applies the invariants to the model answer", () => {
    expect(normalizeToolInput({ verdict: "not_roster", topic: "roster_join", players: ["a"], reason: "x" }).verdict).toBe("roster");
  });

  it("rejects an unknown verdict or topic", () => {
    expect(() => normalizeToolInput({ verdict: "maybe", topic: "sponsor" })).toThrow();
    expect(() => normalizeToolInput({ verdict: "roster", topic: "nope" })).toThrow();
  });

  it("tolerates malformed players and reason", () => {
    expect(normalizeToolInput({ verdict: "unsure", topic: "content", players: "x", reason: 3 })).toMatchObject({ players: [], reason: "" });
  });
});

describe("imageUrlsForVision", () => {
  const media = [
    { type: "photo" as const, url: "https://img/1.jpg", previewUrl: null },
    { type: "video" as const, url: "https://vid/1.mp4", previewUrl: "https://img/preview.jpg" },
  ];

  it("sends photos and video previews when the text is short", () => {
    expect(imageUrlsForVision({ text: "@a #b hi", media, teamName: "T" })).toEqual(["https://img/1.jpg", "https://img/preview.jpg"]);
  });

  it("sends nothing when the text is long enough", () => {
    expect(imageUrlsForVision({ text: "x".repeat(80), media, teamName: "T" })).toEqual([]);
  });
});

describe("classifyTweet", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const toolResponse = (input: object) => new Response(JSON.stringify({ content: [{ type: "tool_use", input }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 });
  const input = { text: "hello", media: [], teamName: "T" };

  it("retries a 429 with exponential delays then succeeds", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(toolResponse({ verdict: "unsure", topic: "content", players: [], reason: "r" }));
    vi.stubGlobal("fetch", fetchMock);
    const delays: number[] = [];

    const result = await classifyTweet(input, async (ms) => void delays.push(ms));

    expect(result).toMatchObject({ verdict: "unsure", inputTokens: 10, outputTokens: 5 });
    expect(delays).toEqual([1000, 2000]);
  });

  it("does not retry a client error", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(classifyTweet(input, async () => {})).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("normalizeToolInput invariants", () => {
  it("downgrades a roster verdict on a non roster topic", () => {
    expect(normalizeToolInput({ verdict: "roster", topic: "sponsor", players: [], reason: "" }).verdict).toBe("unsure");
  });
});
