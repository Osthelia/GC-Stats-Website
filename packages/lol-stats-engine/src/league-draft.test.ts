/**
 * GC-Stats — league-draft.test module
 *
 * The step table of the standard draft, the mapping of Riot's ban turns onto it, the draft checks, and the
 * comparison of an import with a saved draft. No network, no database.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import type { LeagueSide } from "./game-summary";
import { LEAGUE_DRAFT_STEPS, banStepForPickTurn, draftDiffers, draftProblem, draftStep, stepSide, type DraftPick } from "./league-draft";

const KNOWN = new Set(["Ahri", "Jinx", "Leona", "Ambessa", "Sivir"]);

describe("LEAGUE_DRAFT_STEPS", () => {
  it("has 20 steps in the standard tournament order", () => {
    expect(LEAGUE_DRAFT_STEPS.map((s) => s.step)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    // With blue first, the sides read as the tournament draft does: blue and red alternate in the bans and the picks.
    const sides = LEAGUE_DRAFT_STEPS.map((s) => stepSide(s, "blue")[0]!.toUpperCase()).join("");
    expect(sides).toBe("BRBRBR" + "BRRBBR" + "RBRB" + "RBBR");
  });

  it("puts bans on steps 1–6 and 13–16, and picks on 7–12 and 17–20", () => {
    for (const s of LEAGUE_DRAFT_STEPS) {
      const isBan = (s.step >= 1 && s.step <= 6) || (s.step >= 13 && s.step <= 16);
      expect(s.type).toBe(isBan ? "ban" : "pick");
    }
  });

  it("gives the phase and turn of each step", () => {
    expect(draftStep(1)).toMatchObject({ phase: "ban1", type: "ban", turn: "first" });
    expect(draftStep(9)).toMatchObject({ phase: "pick1", type: "pick", turn: "second" });
    expect(draftStep(13)).toMatchObject({ phase: "ban2", type: "ban", turn: "second" });
    expect(draftStep(20)).toMatchObject({ phase: "pick2", type: "pick", turn: "second" });
    expect(draftStep(21)).toBeNull();
  });
});

describe("stepSide", () => {
  it("gives the first-pick side the first turns, and the other side the second turns", () => {
    for (const firstPick of ["blue", "red"] as const) {
      const other = firstPick === "blue" ? "red" : "blue";
      for (const s of LEAGUE_DRAFT_STEPS) {
        expect(stepSide(s, firstPick)).toBe(s.turn === "first" ? firstPick : other);
      }
    }
  });

  it("gives the first ban and the first pick to the side with the first pick, whichever side that is", () => {
    expect(stepSide(draftStep(1)!, "red")).toBe("red");
    expect(stepSide(draftStep(7)!, "red")).toBe("red");
    expect(stepSide(draftStep(2)!, "red")).toBe("blue");
    expect(stepSide(draftStep(13)!, "red")).toBe("blue");
  });
});

describe("banStepForPickTurn", () => {
  it("keeps the first six ban turns and moves turns 7–10 after the picks of phase 1", () => {
    expect([1, 2, 3, 4, 5, 6].map(banStepForPickTurn)).toEqual([1, 2, 3, 4, 5, 6]);
    expect([7, 8, 9, 10].map(banStepForPickTurn)).toEqual([13, 14, 15, 16]);
  });

  it("gives each ban turn the side Riot's team made it, for either side opening the bans", () => {
    // Riot's pickTurn in the Play-In export: blue opens with 1, 3, 5, 8, 10 in some games, red with 1, 3, 5, 8, 10 in others.
    for (const blueTurns of [
      [1, 3, 5, 8, 10],
      [2, 4, 6, 7, 9],
    ]) {
      const firstPick: LeagueSide = blueTurns.includes(1) ? "blue" : "red";
      for (const turn of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const side = blueTurns.includes(turn) ? "blue" : "red";
        expect(stepSide(draftStep(banStepForPickTurn(turn))!, firstPick)).toBe(side);
      }
    }
  });

  it("rejects turns outside 1–10", () => {
    expect(() => banStepForPickTurn(0)).toThrow();
    expect(() => banStepForPickTurn(11)).toThrow();
  });
});

describe("draftProblem", () => {
  it("is null for a draft with gaps, skipped bans and unplaced picks", () => {
    expect(draftProblem({ steps: [{ step: 1, championName: "Ahri" }, { step: 9, championName: "Jinx" }], unplacedPicks: ["Leona"], knownChampions: KNOWN })).toBeNull();
    expect(draftProblem({ steps: [], unplacedPicks: [], knownChampions: KNOWN })).toBeNull();
  });

  it("refuses a step that does not exist", () => {
    expect(draftProblem({ steps: [{ step: 21, championName: "Ahri" }], unplacedPicks: [], knownChampions: KNOWN })).toEqual({ kind: "invalidStep", step: 21 });
  });

  it("refuses a step given twice", () => {
    expect(
      draftProblem({
        steps: [
          { step: 1, championName: "Ahri" },
          { step: 1, championName: "Jinx" },
        ],
        unplacedPicks: [],
        knownChampions: KNOWN,
      })
    ).toEqual({ kind: "invalidStep", step: 1 });
  });

  it("refuses a champion the catalog does not name", () => {
    expect(draftProblem({ steps: [{ step: 1, championName: "Unknownia" }], unplacedPicks: [], knownChampions: KNOWN })).toEqual({
      kind: "unknownChampion",
      championName: "Unknownia",
    });
  });

  it("refuses a champion used twice, in two steps or in a step and among the unplaced picks", () => {
    expect(
      draftProblem({
        steps: [
          { step: 1, championName: "Ahri" },
          { step: 2, championName: "Ahri" },
        ],
        unplacedPicks: [],
        knownChampions: KNOWN,
      })
    ).toEqual({ kind: "duplicateChampion", championName: "Ahri" });
    expect(draftProblem({ steps: [{ step: 7, championName: "Jinx" }], unplacedPicks: ["Jinx"], knownChampions: KNOWN })).toEqual({
      kind: "duplicateChampion",
      championName: "Jinx",
    });
  });
});

describe("draftDiffers", () => {
  const imported: DraftPick[] = [
    { side: "blue", type: "ban", championName: "Ahri" },
    { side: "red", type: "pick", championName: "Jinx" },
  ];

  it("is false when the same champions are on the same sides, whatever their order", () => {
    expect(draftDiffers(imported, [...imported].reverse())).toBe(false);
  });

  it("is true when a champion, a side or a kind differs, or when one is missing", () => {
    expect(draftDiffers(imported, [{ side: "blue", type: "ban", championName: "Leona" }, imported[1]!])).toBe(true);
    expect(draftDiffers(imported, [{ side: "red", type: "ban", championName: "Ahri" }, imported[1]!])).toBe(true);
    expect(draftDiffers(imported, [{ side: "blue", type: "pick", championName: "Ahri" }, imported[1]!])).toBe(true);
    expect(draftDiffers(imported, [imported[0]!])).toBe(true);
  });
});
