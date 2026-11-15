import { describe, expect, it, vi } from "vitest";

vi.mock("@gc-stats/db/client", () => ({ adminDb: {} }));
vi.mock("@/lib/admin-liquipedia", () => ({ findLiquipediaMappings: vi.fn() }));

import { opponentsSwapped } from "./liquipedia-team-links";

const bees = new Set(["rising bees", "vitality rising bees"]);
const hel = new Set(["g2 hel"]);

describe("opponentsSwapped", () => {
  it("is false when the paste lists the teams in our order", () => {
    expect(opponentsSwapped({ 1: "Rising Bees", 2: "g2 hel" }, bees, hel)).toBe(false);
  });

  it("is true when the paste lists the teams the other way round, from one name or both", () => {
    expect(opponentsSwapped({ 1: "g2 hel", 2: "Rising Bees" }, bees, hel)).toBe(true);
    expect(opponentsSwapped({ 1: "g2 hel", 2: null }, bees, hel)).toBe(true);
    expect(opponentsSwapped({ 1: null, 2: "Rising Bees" }, bees, hel)).toBe(true);
  });

  it("is false when no name is known or the names contradict each other", () => {
    expect(opponentsSwapped({ 1: "Unknown A", 2: "Unknown B" }, bees, hel)).toBe(false);
    expect(opponentsSwapped({ 1: "g2 hel", 2: "g2 hel" }, bees, hel)).toBe(false);
    expect(opponentsSwapped({ 1: "Rising Bees", 2: "Vitality Rising Bees" }, bees, hel)).toBe(false);
  });
});
