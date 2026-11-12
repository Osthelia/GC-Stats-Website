import { afterEach, describe, expect, it, vi } from "vitest";
import { fallbackPublicGame, isGamePublic, parsePublicGames, publicGames } from "./public-games";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("parsePublicGames", () => {
  it("falls back to the default game when unset or empty", () => {
    expect(parsePublicGames(undefined)).toEqual(["valorant"]);
    expect(parsePublicGames("")).toEqual(["valorant"]);
    expect(parsePublicGames(" , ,")).toEqual(["valorant"]);
  });

  it("trims and lower-cases", () => {
    expect(parsePublicGames(" Valorant , LOL ")).toEqual(["valorant", "lol"]);
  });

  it("ignores unknown slugs with one warning each", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePublicGames("valorant,dota,dota")).toEqual(["valorant"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default game when nothing valid is left", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePublicGames("csgo")).toEqual(["valorant"]);
  });

  it("removes duplicates", () => {
    expect(parsePublicGames("lol,lol,valorant")).toEqual(["lol", "valorant"]);
  });
});

describe("environment", () => {
  it("shows only Valorant when unset", () => {
    vi.stubEnv("PUBLIC_GAMES", "");
    expect(publicGames()).toEqual(["valorant"]);
    expect(isGamePublic("valorant")).toBe(true);
    expect(isGamePublic("lol")).toBe(false);
  });

  it("makes both games public", () => {
    vi.stubEnv("PUBLIC_GAMES", "valorant,lol");
    expect(isGamePublic("lol")).toBe(true);
  });

  it("parses an unchanged value once, and follows a changed one", () => {
    vi.stubEnv("PUBLIC_GAMES", "valorant,lol");
    const first = publicGames();
    expect(publicGames()).toBe(first);
    vi.stubEnv("PUBLIC_GAMES", "valorant");
    expect(publicGames()).toEqual(["valorant"]);
    expect(isGamePublic("lol")).toBe(false);
  });
});

describe("fallbackPublicGame", () => {
  it("keeps a public preferred game", () => {
    vi.stubEnv("PUBLIC_GAMES", "valorant,lol");
    expect(fallbackPublicGame("lol")).toBe("lol");
  });

  it("uses the first public game for a hidden one", () => {
    vi.stubEnv("PUBLIC_GAMES", "valorant");
    expect(fallbackPublicGame("lol")).toBe("valorant");
  });
});
