import { describe, expect, it } from "vitest";
import { countsForStageScope } from "./config-types";

const group = (config: unknown) => ({ containerType: "group", config });

describe("countsForStageScope", () => {
  it("counts the matches of stage-scoped round robin groups", () => {
    expect(countsForStageScope(group({ type: "round_robin", matchScope: "stage" }))).toBe(true);
  });

  it("leaves out groups that keep to their own matches", () => {
    expect(countsForStageScope(group({ type: "round_robin", matchScope: "container" }))).toBe(false);
    expect(countsForStageScope(group({ type: "round_robin" }))).toBe(false);
    expect(countsForStageScope(group({ type: "swiss", matchScope: "container" }))).toBe(false);
  });

  it("leaves out brackets and malformed configs", () => {
    expect(countsForStageScope({ containerType: "bracket", config: { type: "round_robin", matchScope: "stage" } })).toBe(false);
    expect(countsForStageScope(group(null))).toBe(false);
  });
});
