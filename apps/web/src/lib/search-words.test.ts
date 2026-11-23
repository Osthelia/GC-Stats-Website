import { describe, expect, it } from "vitest";
import { foldForSearch, matchesSearchWords, searchWords } from "./search-words";

const label = "Barcząca Babylon vs Nova Gaming · Game 2 · 14.03.2026";

describe("matchesSearchWords", () => {
  it("finds both team names without the vs, in any order", () => {
    expect(matchesSearchWords(label, searchWords("babylon nova"))).toBe(true);
    expect(matchesSearchWords(label, searchWords("nova bab"))).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(matchesSearchWords(label, searchWords("BARCZACA"))).toBe(true);
    expect(foldForSearch("Łódź Ærø")).toBe("lodz aero");
  });

  it("needs every word", () => {
    expect(matchesSearchWords(label, searchWords("babylon liquid"))).toBe(false);
  });

  it("still finds what a plain substring search found", () => {
    expect(matchesSearchWords(label, searchWords("babylon vs nova"))).toBe(true);
    expect(matchesSearchWords(label, searchWords("n vs n"))).toBe(true);
  });

  it("matches everything for a blank search", () => {
    expect(matchesSearchWords(label, searchWords("   "))).toBe(true);
  });
});
