import { describe, expect, it } from "vitest";
import { buildFromStored, lineupHasStats, lineupProblem, storedBuild, type LineupBuild, type LineupBuildCatalog, type LineupInput, type LineupPlayerInput } from "./league-lineup-rules";

const LANES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
const stats = { kills: 2, deaths: 1, assists: 5, cs: 200, gold: 11000, damage: 15000, vision: 30 };
const team = (entrantId: number, firstPersonId: number, withStats: boolean): LineupPlayerInput[] =>
  LANES.map((role, i) => ({ entrantId, person: { id: firstPersonId + i }, role, championName: null, stats: withStats ? stats : null, build: null }));
// Flash 4, Ignite 14; Electrocute 8112 (Domination 8100), Conqueror 8010 (Precision 8000); Doran's Blade 1055; Stealth Ward 3340.
const buildCatalog: LineupBuildCatalog = {
  summoners: new Set([4, 14]),
  keystones: new Map([
    [8112, 8100],
    [8010, 8000],
  ]),
  trees: new Set([8000, 8100]),
  items: new Set([1055]),
  trinkets: new Set([3340]),
};
const context = { entrantIds: [1, 2], knownChampions: new Set(["Ahri", "Jinx"]), buildCatalog };
const emptyBuild = (): LineupBuild => ({ summoners: [null, null], keystone: null, secondaryTree: null, items: Array(7).fill(null) });

describe("lineupProblem", () => {
  it("accepts a partial lineup without stats", () => {
    expect(lineupProblem({ players: team(1, 10, false).slice(0, 3), durationSeconds: null }, context)).toBeNull();
  });

  it("keeps each lane once per team, and the teams apart", () => {
    const players = [...team(1, 10, false), ...team(2, 20, false)];
    expect(lineupProblem({ players, durationSeconds: null }, context)).toBeNull();
    expect(lineupProblem({ players: [...players, { ...players[0]!, person: { id: 99 } }], durationSeconds: null }, context)).toEqual({
      kind: "duplicateLane",
      role: "TOP",
      at: { entrantId: 1, role: "TOP", field: "player" },
    });
  });

  it("refuses a player twice, an entrant from outside the series and an empty new name, on the player field", () => {
    const [a, b] = team(1, 10, false);
    const onB = { entrantId: 1, role: "JUNGLE", field: "player" };
    expect(lineupProblem({ players: [a!, { ...b!, person: { id: 10 } }], durationSeconds: null }, context)).toEqual({ kind: "duplicatePerson", at: onB });
    expect(lineupProblem({ players: [{ ...a!, person: { newHandle: "Faker" } }, { ...b!, person: { newHandle: " faker " } }], durationSeconds: null }, context)).toEqual({ kind: "duplicatePerson", at: onB });
    expect(lineupProblem({ players: [{ ...a!, entrantId: 3 }], durationSeconds: null }, context)).toEqual({ kind: "notAnEntrant" });
    expect(lineupProblem({ players: [{ ...a!, person: { newHandle: "  " } }], durationSeconds: null }, context)).toEqual({ kind: "invalidHandle", at: { entrantId: 1, role: "TOP", field: "player" } });
  });

  it("checks the champions against the patch, once per game, and allows an unknown one", () => {
    const [a, b] = team(1, 10, false);
    const on = (role: string) => ({ entrantId: 1, role, field: "champion" });
    expect(lineupProblem({ players: [{ ...a!, championName: "Ahri" }, b!], durationSeconds: null }, context)).toBeNull();
    expect(lineupProblem({ players: [{ ...a!, championName: "Teemo" }], durationSeconds: null }, context)).toEqual({ kind: "unknownChampion", championName: "Teemo", at: on("TOP") });
    expect(lineupProblem({ players: [{ ...a!, championName: "Ahri" }, { ...b!, championName: "Ahri" }], durationSeconds: null }, context)).toEqual({ kind: "duplicateChampion", championName: "Ahri", at: on("JUNGLE") });
    expect(lineupProblem({ players: [{ ...a!, championName: "Ahri" }], durationSeconds: null }, { ...context, knownChampions: new Set() })).toEqual({ kind: "championsUnavailable", at: on("TOP") });
  });

  it("needs a scoreboard for every player of both full teams, and the game length", () => {
    const full: LineupInput = { players: [...team(1, 10, true), ...team(2, 20, true)], durationSeconds: 1800 };
    expect(lineupHasStats(full)).toBe(true);
    expect(lineupProblem(full, context)).toBeNull();
    expect(lineupProblem({ ...full, players: full.players.slice(1) }, context)).toEqual({ kind: "playerMissing", at: { entrantId: 1, role: "TOP", field: "player" } });
    expect(lineupProblem({ ...full, players: full.players.map((p, i) => (i === 3 ? { ...p, stats: null } : p)) }, context)).toEqual({ kind: "statMissing", at: { entrantId: 1, role: "BOTTOM", field: "kills" } });
    expect(lineupProblem({ ...full, durationSeconds: null }, context)).toEqual({ kind: "durationRequired" });
    expect(lineupProblem({ ...full, players: full.players.map((p, i) => (i === 0 ? { ...p, stats: { ...stats, kills: -1 } } : p)) }, context)).toEqual({
      kind: "invalidStat",
      max: 100,
      at: { entrantId: 1, role: "TOP", field: "kills" },
    });
    expect(lineupProblem({ ...full, players: full.players.map((p, i) => (i === 0 ? { ...p, stats: { ...stats, gold: 1.5 } } : p)) }, context)).toEqual({
      kind: "invalidStat",
      max: 100_000,
      at: { entrantId: 1, role: "TOP", field: "gold" },
    });
  });

  it("lets gold, damage and vision be left out, but not the K/D/A or the CS", () => {
    const full: LineupInput = { players: [...team(1, 10, true), ...team(2, 20, true)], durationSeconds: 1800 };
    const without = (key: string) => ({ ...full, players: full.players.map((p, i) => (i === 7 ? { ...p, stats: { ...stats, [key]: null } } : p)) });
    for (const key of ["gold", "damage", "vision"]) expect(lineupProblem(without(key), context)).toBeNull();
    for (const key of ["kills", "deaths", "assists", "cs"]) expect(lineupProblem(without(key), context)).toEqual({ kind: "statMissing", at: { entrantId: 2, role: "MIDDLE", field: key } });
  });

  it("checks a build against the patch, every part optional", () => {
    const [a] = team(1, 10, false);
    const withBuild = (build: Partial<LineupBuild>) => ({ players: [{ ...a!, build: { ...emptyBuild(), ...build } }], durationSeconds: null });
    const on = (field: string) => ({ entrantId: 1, role: "TOP", field });
    const items = (slot: number, id: number) => emptyBuild().items.map((v, i) => (i === slot ? id : v));
    expect(lineupProblem(withBuild({}), context)).toBeNull();
    expect(lineupProblem(withBuild({ summoners: [4, 14], keystone: 8112, secondaryTree: 8000, items: items(6, 3340) }), context)).toBeNull();
    expect(lineupProblem(withBuild({ summoners: [null, 99] }), context)).toEqual({ kind: "unknownBuildPart", at: on("summoner.1") });
    expect(lineupProblem(withBuild({ summoners: [4, 4] }), context)).toEqual({ kind: "duplicateSummoner", at: on("summoner.1") });
    expect(lineupProblem(withBuild({ keystone: 8000 }), context)).toEqual({ kind: "unknownBuildPart", at: on("keystone") });
    expect(lineupProblem(withBuild({ keystone: 8112, secondaryTree: 8100 }), context)).toEqual({ kind: "secondaryTreeOfKeystone", at: on("secondaryTree") });
    // A trinket only in the trinket slot, and an item never there.
    expect(lineupProblem(withBuild({ items: items(2, 3340) }), context)).toEqual({ kind: "unknownBuildPart", at: on("item.2") });
    expect(lineupProblem(withBuild({ items: items(6, 1055) }), context)).toEqual({ kind: "unknownBuildPart", at: on("item.6") });
    expect(lineupProblem(withBuild({ keystone: 8112 }), { ...context, buildCatalog: null })).toEqual({ kind: "buildUnavailable", at: on("keystone") });
    expect(lineupProblem(withBuild({}), { ...context, buildCatalog: null })).toBeNull();
  });
});

describe("storedBuild and buildFromStored", () => {
  it("keeps the item slots, so a build without a trinket keeps its last item an item", () => {
    const build: LineupBuild = { summoners: [null, 4], keystone: 8112, secondaryTree: 8000, items: [1055, null, null, null, null, null, null] };
    const stored = storedBuild(build);
    expect(stored).toEqual({ summoners: [4], items: [1055, 0, 0, 0, 0, 0, 0], runes: { primaryPerks: [8112], subStyle: 8000 } });
    expect(buildFromStored(stored.summoners, stored.items, stored.runes)).toEqual({ ...build, summoners: [4, null] });
  });

  it("stores an empty build as nothing", () => {
    expect(storedBuild(emptyBuild())).toEqual({ summoners: [], items: [], runes: {} });
    expect(storedBuild(null)).toEqual({ summoners: [], items: [], runes: {} });
    expect(buildFromStored([], [], {})).toBeNull();
  });
});
