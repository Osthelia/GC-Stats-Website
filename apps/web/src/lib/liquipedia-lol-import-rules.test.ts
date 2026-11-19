import { describe, expect, it } from "vitest";
import { draftBlockedBy, planGameFields } from "./liquipedia-lol-import-rules";

describe("planGameFields", () => {
  it("fills everything the wikicode has into a new game", () => {
    expect(planGameFields(null, { winnerEntrantId: 7, lengthSeconds: 2201 })).toEqual({
      values: { winnerEntrantId: 7, isCompleted: true, durationSeconds: 2201 },
      filled: ["winner", "duration"],
      differs: [],
    });
  });

  it("does not complete a new game without a winner", () => {
    expect(planGameFields(null, { winnerEntrantId: null, lengthSeconds: 1800 })).toEqual({ values: { durationSeconds: 1800 }, filled: ["duration"], differs: [] });
  });

  it("fills only the empty fields of an existing game", () => {
    const plan = planGameFields({ winnerEntrantId: null, durationSeconds: 1999 }, { winnerEntrantId: 7, lengthSeconds: 1999 });
    expect(plan).toEqual({ values: { winnerEntrantId: 7, isCompleted: true }, filled: ["winner"], differs: [] });
  });

  it("reports a different winner or length and changes nothing", () => {
    const plan = planGameFields({ winnerEntrantId: 8, durationSeconds: 1999 }, { winnerEntrantId: 7, lengthSeconds: 2201 });
    expect(plan).toEqual({ values: {}, filled: [], differs: ["winner", "duration"] });
  });

  it("is quiet when the game already says the same", () => {
    expect(planGameFields({ winnerEntrantId: 7, durationSeconds: 2201 }, { winnerEntrantId: 7, lengthSeconds: 2201 })).toEqual({ values: {}, filled: [], differs: [] });
  });
});

describe("draftBlockedBy", () => {
  const free = { source: null, draftEditedAt: null, hasDraftRows: false, hasTeamStats: false };

  it("lets the wikicode write the draft of a game with no draft and no data", () => {
    expect(draftBlockedBy(free)).toBeNull();
  });

  it("keeps a draft edited by hand, before anything else", () => {
    expect(draftBlockedBy({ ...free, draftEditedAt: new Date(), source: "riot", hasDraftRows: true })).toBe("editedByHand");
  });

  it("keeps Leaguepedia and Riot data", () => {
    expect(draftBlockedBy({ ...free, source: "leaguepedia" })).toBe("leaguepediaData");
    expect(draftBlockedBy({ ...free, source: "riot" })).toBe("riotData");
    expect(draftBlockedBy({ ...free, hasTeamStats: true })).toBe("riotData");
  });

  it("keeps an existing draft, which also covers an earlier wikicode import", () => {
    expect(draftBlockedBy({ ...free, hasDraftRows: true })).toBe("existingDraft");
  });
});
