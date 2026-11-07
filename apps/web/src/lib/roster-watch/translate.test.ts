import { afterEach, describe, expect, it, vi } from "vitest";
import { translateToEnglish } from "./translate";

const reply = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("translateToEnglish", () => {
  it("does nothing without a key or without text", async () => {
    const fetchMock = reply({});
    vi.stubGlobal("fetch", fetchMock);
    expect(await translateToEnglish("Bienvenue")).toBeNull();
    vi.stubEnv("DEEPL_API_KEY", "key");
    expect(await translateToEnglish("   ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the translation and sends the key", async () => {
    vi.stubEnv("DEEPL_API_KEY", "key");
    const fetchMock = reply({ translations: [{ detected_source_language: "FR", text: "Welcome" }] });
    vi.stubGlobal("fetch", fetchMock);
    expect(await translateToEnglish("Bienvenue")).toBe("Welcome");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { Authorization: "DeepL-Auth-Key key" } });
  });

  it("returns null for a tweet already in English", async () => {
    vi.stubEnv("DEEPL_API_KEY", "key");
    vi.stubGlobal("fetch", reply({ translations: [{ detected_source_language: "EN", text: "Welcome" }] }));
    expect(await translateToEnglish("Welcome")).toBeNull();
  });

  it("swallows API and network failures", async () => {
    vi.stubEnv("DEEPL_API_KEY", "key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", reply({}, 456));
    expect(await translateToEnglish("Bienvenue")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await translateToEnglish("Bienvenue")).toBeNull();
  });
});
