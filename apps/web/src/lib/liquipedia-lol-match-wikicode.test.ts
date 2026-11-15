import { describe, expect, it } from "vitest";
import {
  banSlotOfStep,
  banStepsOfTurn,
  buildLolMatchWikicode,
  championKey,
  championsInLaneOrder,
  draftFromWikicode,
  parseGameLength,
  parseLolMatchWikicode,
  resolveChampionNames,
  type WikicodeLolBuildGame,
  type WikicodeLolGame,
} from "./liquipedia-lol-match-wikicode";

const GAME_1 = `|map1={{Map
        |vod=https://example.com/v1
        |team1side=red
        |t1c1=jax |t1c2=nocturne |t1c3=syndra |t1c4=ziggs |t1c5=nautilus
        |t1b1=locke |t1b2=vi |t1b3=seraphine |t1b4=sivir |t1b5=jayce
        |team2side=blue
        |t2c1=ksante |t2c2=vi |t2c3=orianna |t2c4=kaisa |t2c5=braum
        |t2b1=ahri |t2b2= |t2b3=zed |t2b4=yone |t2b5=lux
        |length=36:41 |winner=1
    }}`;

function match(body: string, head = "|bestof=3\n    |opponent1={{TeamOpponent|Rising Bees}}\n    |opponent2={{TeamOpponent|g2 hel}}\n    |patch=26.13") {
  return `{{Match\n    ${head}\n    ${body}\n}}`;
}

describe("parseLolMatchWikicode", () => {
  it("reads a 2–0 with a skipped game 3", () => {
    const code = match(`${GAME_1}\n    |map2={{Map|team1side=blue|winner=1|length=28:02|t1c1=aatrox}}\n    |map3={{Map|finished=skip}}`);
    const result = parseLolMatchWikicode(code);
    if (!result.ok) throw new Error("expected ok");
    expect(result.match.bestOf).toBe(3);
    expect(result.match.patch).toBe("26.13");
    expect(result.match.forfeit).toBe(false);
    expect(result.match.games.map((g) => g.order)).toEqual([1, 2]);

    const [game1] = result.match.games;
    expect(game1?.team1Side).toBe("red");
    expect(game1?.winner).toBe(1);
    expect(game1?.lengthSeconds).toBe(36 * 60 + 41);
    expect(game1?.team1.champions).toEqual(["jax", "nocturne", "syndra", "ziggs", "nautilus"]);
    expect(game1?.team1.bans).toEqual(["locke", "vi", "seraphine", "sivir", "jayce"]);
    expect(game1?.team2.bans).toEqual(["ahri", "", "zed", "yone", "lux"]);
  });

  it("reads a 2–1 and keeps a game without a winner as played when it has data", () => {
    const code = match(`${GAME_1}\n    |map2={{Map|winner=2|length=30:00}}\n    |map3={{Map|winner=1|length=25:10}}`);
    const result = parseLolMatchWikicode(code);
    if (!result.ok) throw new Error("expected ok");
    expect(result.match.games.map((g) => [g.order, g.winner])).toEqual([[1, 1], [2, 2], [3, 1]]);
  });

  it("reads a Bo5 and leaves out empty games that are still to be played", () => {
    const code = match(`${GAME_1}\n    |map2={{Map|winner=2}}\n    |map3={{Map}}\n    |map4={{Map}}\n    |map5={{Map}}`, "|bestof=5\n    |opponent1={{TeamOpponent|A}}\n    |opponent2={{TeamOpponent|B}}");
    const result = parseLolMatchWikicode(code);
    if (!result.ok) throw new Error("expected ok");
    expect(result.match.bestOf).toBe(5);
    expect(result.match.patch).toBeNull();
    expect(result.match.games.map((g) => g.order)).toEqual([1, 2]);
  });

  it("reads a forfeit as a match without games", () => {
    const code = `{{Match|bestof=3|opponent1={{TeamOpponent|Rising Bees|score=W}}|opponent2={{TeamOpponent|g2 hel|score=FF}}}}`;
    const result = parseLolMatchWikicode(code);
    if (!result.ok) throw new Error("expected ok");
    expect(result.match.forfeit).toBe(true);
    expect(result.match.games).toEqual([]);
  });

  it("wants exactly one {{Match}}", () => {
    expect(parseLolMatchWikicode("nothing here")).toEqual({ ok: false, error: "oneMatchOnly" });
    const two = `${match(GAME_1)}\n${match(GAME_1)}`;
    expect(parseLolMatchWikicode(two)).toEqual({ ok: false, error: "oneMatchOnly" });
  });

  it("does not take a MatchPage or a MatchMaps for a Match", () => {
    expect(parseLolMatchWikicode("{{MatchPage|a=b}}")).toEqual({ ok: false, error: "oneMatchOnly" });
  });
});

describe("game length", () => {
  it("reads m:ss", () => {
    expect(parseGameLength("36:41")).toBe(2201);
    expect(parseGameLength("1:02:03")).toBe(3723);
    expect(parseGameLength("abc")).toBeNull();
    expect(parseGameLength("")).toBeNull();
  });
});

describe("resolveChampionNames", () => {
  const catalog = ["K'Sante", "Kai'Sa", "Miss Fortune", "Jarvan IV", "Dr. Mundo", "Nunu & Willump", "Renata Glasc", "Orianna", "Jax"];

  it("matches ignoring case, spaces and punctuation", () => {
    expect(championKey("K'Sante")).toBe("ksante");
    const result = resolveChampionNames(["ksante", "kaisa", "missfortune", "jax"], catalog);
    if (!result.ok) throw new Error("expected ok");
    expect(result.byWikicodeName.get("ksante")).toBe("K'Sante");
    expect(result.byWikicodeName.get("kaisa")).toBe("Kai'Sa");
    expect(result.byWikicodeName.get("missfortune")).toBe("Miss Fortune");
  });

  it("knows the shortened names and the typo that appear on Liquipedia", () => {
    const result = resolveChampionNames(["jarvan", "mundo", "nunu", "renata", "oriana"], catalog);
    if (!result.ok) throw new Error("expected ok");
    expect([...result.byWikicodeName.values()]).toEqual(["Jarvan IV", "Dr. Mundo", "Nunu & Willump", "Renata Glasc", "Orianna"]);
  });

  it("lists every unknown name and ignores empty slots", () => {
    expect(resolveChampionNames(["jax", "", "nope", "alsonope", "nope"], catalog)).toEqual({ ok: false, unknown: ["nope", "alsonope"] });
  });
});

describe("ban steps", () => {
  it("gives the team with the first turn the odd steps of phase 1 and the even ones of phase 2", () => {
    expect(banStepsOfTurn("first")).toEqual([1, 3, 5, 14, 16]);
    expect(banStepsOfTurn("second")).toEqual([2, 4, 6, 13, 15]);
  });

  it("knows the slot of a step, and that a pick has none", () => {
    expect(banSlotOfStep(1)).toBe(1);
    expect(banSlotOfStep(2)).toBe(1);
    expect(banSlotOfStep(14)).toBe(4);
    expect(banSlotOfStep(13)).toBe(4);
    expect(banSlotOfStep(16)).toBe(5);
    expect(banSlotOfStep(7)).toBeNull();
    expect(banSlotOfStep(99)).toBeNull();
  });
});

describe("draftFromWikicode", () => {
  const parsed = parseLolMatchWikicode(match(GAME_1));
  if (!parsed.ok) throw new Error("fixture");
  const game = parsed.match.games[0] as WikicodeLolGame;
  const names = new Map<string, string>();

  it("puts the bans of the first-pick side on the odd steps (blue first pick, team 1 on blue)", () => {
    const draft = draftFromWikicode(game, names, "blue", "blue");
    // Team 1 is blue = first: its bans go on 1, 3, 5, 14, 16. Team 2 (red) on 2, 4, 6, 13, 15; its empty slot 2 leaves step 4 empty.
    expect(draft.steps.map((s) => [s.step, s.side, s.championName])).toEqual([
      [1, "blue", "locke"],
      [2, "red", "ahri"],
      [3, "blue", "vi"],
      [5, "blue", "seraphine"],
      [6, "red", "zed"],
      [13, "red", "yone"],
      [14, "blue", "sivir"],
      [15, "red", "lux"],
      [16, "blue", "jayce"],
    ]);
    expect(draft.unplacedPicks.filter((p) => p.side === "blue").map((p) => p.championName)).toEqual(["jax", "nocturne", "syndra", "ziggs", "nautilus"]);
    expect(draft.unplacedPicks).toHaveLength(10);
  });

  it("swaps every step when red has the first pick", () => {
    const draft = draftFromWikicode(game, names, "blue", "red");
    expect(draft.steps.find((s) => s.championName === "locke")).toEqual({ step: 2, side: "blue", championName: "locke" });
    expect(draft.steps.find((s) => s.championName === "ahri")).toEqual({ step: 1, side: "red", championName: "ahri" });
    expect(draft.steps.find((s) => s.championName === "jayce")).toEqual({ step: 15, side: "blue", championName: "jayce" });
  });

  it("gives team 1 the red side when team1side is red", () => {
    const draft = draftFromWikicode(game, names, "red", "blue");
    expect(draft.steps.find((s) => s.championName === "locke")).toEqual({ step: 2, side: "red", championName: "locke" });
  });

  it("uses the display name from the champion resolution", () => {
    const draft = draftFromWikicode(game, new Map([["ksante", "K'Sante"], ["locke", "Locke"]]), "blue", "blue");
    expect(draft.steps[0]?.championName).toBe("Locke");
    expect(draft.unplacedPicks.some((p) => p.championName === "K'Sante")).toBe(true);
  });
});

describe("championsInLaneOrder", () => {
  const player = (role: string | null, championName: string) => ({ role, championName });

  it("orders by lane, not by the order of the rows", () => {
    const rows = [player("UTILITY", "Braum"), player("TOP", "K'Sante"), player("BOTTOM", "Kai'Sa"), player("JUNGLE", "Vi"), player("MIDDLE", "Orianna")];
    expect(championsInLaneOrder(rows)).toEqual(["K'Sante", "Vi", "Orianna", "Kai'Sa", "Braum"]);
  });

  it("gives nothing when a lane is missing or twice", () => {
    expect(championsInLaneOrder([player("TOP", "A"), player("TOP", "B"), player("MIDDLE", "C"), player("BOTTOM", "D"), player("UTILITY", "E")])).toEqual([]);
    expect(championsInLaneOrder([player(null, "A"), player("JUNGLE", "B"), player("MIDDLE", "C"), player("BOTTOM", "D"), player("UTILITY", "E")])).toEqual([]);
    expect(championsInLaneOrder([player("TOP", "A")])).toEqual([]);
  });
});

describe("buildLolMatchWikicode", () => {
  const base = {
    scheduledAt: new Date("2026-07-28T16:00:00Z"),
    bestOf: 3,
    completed: true,
    forfeitWinner: null,
    score: null,
    opponent1: "Rising Bees",
    opponent2: "g2 hel",
    twitch: ["equalesportsgg", "second"],
    youtube: [],
    patch: "26.13",
  };
  const game: WikicodeLolBuildGame = {
    team1Side: "red",
    winner: 1,
    durationSeconds: 2201,
    team1Champions: ["Jax", "Nocturne", "Syndra", "Ziggs", "Nautilus"],
    team2Champions: ["K'Sante", "Vi", "Orianna", "Kai'Sa", "Braum"],
    team1Bans: ["Locke", "Vi", "Seraphine", "Sivir", "Jayce"],
    team2Bans: ["Ahri", "", "Zed", "", ""],
  };

  it("writes the match, a played game and the skipped third game", () => {
    const code = buildLolMatchWikicode({ ...base, games: [game, { ...game, team1Side: "blue", winner: 1 }] });
    expect(code).toContain("{{Match\n");
    expect(code).toContain("|bestof=3");
    expect(code).toContain("|opponent1={{TeamOpponent|Rising Bees}}");
    expect(code).toContain("|date=July 28, 2026 - 16:00 {{Abbr/UTC}}");
    expect(code).toContain("|twitch=equalesportsgg|twitch2=second");
    expect(code).toContain("|patch=26.13");
    expect(code).toContain("|map1={{Map");
    expect(code).toContain("|team1side=red");
    expect(code).toContain("|team2side=blue");
    expect(code).toContain("|t1c1=jax");
    expect(code).toContain("|t2c1=ksante");
    expect(code).toContain("|t2c4=kaisa");
    expect(code).toContain("|t1b5=jayce");
    expect(code).toContain("|length=36:41");
    expect(code).toContain("|winner=1");
    expect(code).toContain("|map3={{Map|finished=skip}}");
    expect(code.endsWith("}}")).toBe(true);
  });

  it("keeps an empty ban slot between bans and drops the empty ones at the end", () => {
    const code = buildLolMatchWikicode({ ...base, games: [game] });
    expect(code).toContain("|t2b1=ahri\n        |t2b2=\n        |t2b3=zed");
    expect(code).not.toContain("t2b4");
  });

  it("leaves the champion params out without full player data, and the side without a side", () => {
    const code = buildLolMatchWikicode({ ...base, games: [{ ...game, team1Champions: [], team2Champions: [], team1Side: null }] });
    expect(code).not.toContain("t1c1");
    expect(code).not.toContain("t2c1");
    expect(code).not.toContain("team1side");
    expect(code).toContain("|t1b1=locke");
  });

  it("writes an empty {{Map}} for unplayed games while the match is open", () => {
    const code = buildLolMatchWikicode({ ...base, completed: false, games: [game] });
    expect(code).toContain("|map2={{Map}}");
    expect(code).toContain("|map3={{Map}}");
    expect(code).not.toContain("finished=skip");
  });

  it("writes a forfeit as scores on the opponents and no games", () => {
    const code = buildLolMatchWikicode({ ...base, forfeitWinner: 2, games: [] });
    expect(code).toContain("|opponent1={{TeamOpponent|Rising Bees|score=FF}}");
    expect(code).toContain("|opponent2={{TeamOpponent|g2 hel|score=W}}");
    expect(code).not.toContain("|map1");
  });

  it("writes the reported score instead of skipped games when a completed match has no games", () => {
    const code = buildLolMatchWikicode({ ...base, score: { 1: 2, 2: 0 }, games: [] });
    expect(code).toContain("|opponent1={{TeamOpponent|Rising Bees|score=2}}");
    expect(code).toContain("|opponent2={{TeamOpponent|g2 hel|score=0}}");
    expect(code).not.toContain("|map1");
    // With games, Liquipedia counts them itself.
    expect(buildLolMatchWikicode({ ...base, score: { 1: 2, 2: 0 }, games: [game] })).not.toContain("score=");
  });

  it("is read back by the parser", () => {
    const code = buildLolMatchWikicode({ ...base, games: [game] });
    const result = parseLolMatchWikicode(code);
    if (!result.ok) throw new Error("expected ok");
    expect(result.match.games).toHaveLength(1);
    expect(result.match.games[0]?.team1.champions[0]).toBe("jax");
    expect(result.match.games[0]?.lengthSeconds).toBe(2201);
    expect(result.match.patch).toBe("26.13");
  });
});
