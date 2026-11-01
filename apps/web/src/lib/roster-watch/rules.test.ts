import { describe, expect, it } from "vitest";
import { applyRules, compileRuleRegex, DEFAULT_RULES } from "./rules";

describe("rule regexes", () => {
  it("compiles every regex of rules.json", () => {
    for (const rule of DEFAULT_RULES.exclude) if (rule.regex) expect(compileRuleRegex(rule.regex), rule.id).not.toBeNull();
  });

  it("ignores an invalid regex instead of throwing", () => {
    expect(compileRuleRegex("(")).toBeNull();
    const rules = { neverExclude: { anyKeywords: [] }, exclude: [{ id: "bad", regex: "(" }] };
    expect(applyRules({ text: "anything", mediaTypes: [] }, rules)).toEqual({ excluded: false });
  });
});

const text = (value: string, mediaTypes: ("photo" | "video")[] = []) => applyRules({ text: value, mediaTypes });

describe("applyRules", () => {
  it("lets never_exclude keywords win over an exclusion rule", () => {
    expect(text("Welcome to the team! Map 1 tonight")).toEqual({ excluded: false });
    expect(text("Matchday, and a new player joins")).toEqual({ excluded: false });
  });

  it("excludes with the id of the matching rule", () => {
    expect(text("Matchday vs Team X")).toEqual({ excluded: true, ruleId: "matchday" });
    expect(text("We won 2-0")).toEqual({ excluded: true, ruleId: "result" });
    expect(text("gg well played")).toEqual({ excluded: true, ruleId: "gg" });
  });

  it("matches the score regex with dash, en dash and colon", () => {
    for (const score of ["2-1", "13 – 7", "2:0"]) expect(text(`Final ${score}`)).toEqual({ excluded: true, ruleId: "result" });
  });

  it("does not mistake clock times or dates for a score", () => {
    expect(text("Big announcement today at 18:00 CET, stay tuned")).toEqual({ excluded: false });
    expect(text("Something new on 12-15")).toEqual({ excluded: false });
  });

  it("is case insensitive", () => {
    expect(text("MATCHDAY")).toEqual({ excluded: true, ruleId: "matchday" });
    expect(text("WELCOME aboard, 2-0")).toEqual({ excluded: false });
  });

  it("matches whole words only", () => {
    expect(text("What a nice place")).toEqual({ excluded: false });
    expect(text("benchmark results")).toEqual({ excluded: false });
  });

  it("applies requires_media only when the media type is present", () => {
    expect(text("insane clutch")).toEqual({ excluded: false });
    expect(text("insane clutch", ["photo"])).toEqual({ excluded: false });
    expect(text("insane clutch", ["video"])).toEqual({ excluded: true, ruleId: "highlight" });
  });

  it("sends unknown tweets to the LLM", () => {
    expect(text("Something is coming")).toEqual({ excluded: false });
  });
});
