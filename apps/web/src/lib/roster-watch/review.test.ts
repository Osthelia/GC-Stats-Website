import { describe, expect, it } from "vitest";
import { normalizeXHandle, planReview, type ReviewableSignal } from "./review";

const signal = (overrides: Partial<ReviewableSignal>): ReviewableSignal => ({ stage: "classified", verdict: "roster", status: "pending", ...overrides });

describe("planReview", () => {
  it("moves roster and unsure tweets to team_edited or ignored", () => {
    expect(planReview(signal({ verdict: "roster" }), { action: "team_edited" })).toMatchObject({ ok: true, patch: { status: "team_edited" } });
    expect(planReview(signal({ verdict: "unsure" }), { action: "ignored" })).toMatchObject({ ok: true, patch: { status: "ignored" } });
  });

  it("refuses to review a tweet twice", () => {
    expect(planReview(signal({ status: "ignored" }), { action: "ignored" })).toEqual({ ok: false, error: "invalidState" });
  });

  it("requires a valid topic for not roster, the note is optional", () => {
    const unsure = signal({ verdict: "unsure" });
    expect(planReview(unsure, { action: "marked_not_roster", reviewTopic: "sponsor", reviewNote: "   " })).toMatchObject({ ok: true, patch: { reviewNote: null } });
    expect(planReview(unsure, { action: "marked_not_roster", reviewTopic: "not_enough_info" })).toMatchObject({ ok: true, patch: { reviewTopic: "not_enough_info", reviewNote: null } });
    expect(planReview(unsure, { action: "marked_not_roster", reviewTopic: "roster_join", reviewNote: "x" })).toEqual({ ok: false, error: "invalidTopic", field: "reviewTopic" });
    expect(planReview(unsure, { action: "marked_not_roster", reviewTopic: "sponsor", reviewNote: " promo code " })).toMatchObject({
      ok: true,
      patch: { status: "marked_not_roster", reviewTopic: "sponsor", reviewNote: "promo code" },
    });
  });

  it("allows not roster on roster and unsure tweets only", () => {
    expect(planReview(signal({ verdict: "roster" }), { action: "marked_not_roster", reviewTopic: "sponsor", reviewNote: "x" })).toMatchObject({ ok: true, patch: { status: "marked_not_roster" } });
    expect(planReview(signal({ verdict: "not_roster" }), { action: "marked_not_roster", reviewTopic: "sponsor", reviewNote: "x" })).toEqual({ ok: false, error: "invalidState" });
  });

  it("reports a missed roster from the audit, note optional", () => {
    expect(planReview(signal({ verdict: "not_roster" }), { action: "reported_missed", reviewNote: "" })).toMatchObject({ ok: true, patch: { status: "reported_missed", reviewNote: null } });
    expect(planReview(signal({ stage: "excluded", verdict: null }), { action: "reported_missed", reviewNote: "rule matchday" })).toMatchObject({ ok: true });
    expect(planReview(signal({ verdict: "roster" }), { action: "reported_missed", reviewNote: "" })).toEqual({ ok: false, error: "invalidState" });
  });

  it("rejects an oversized note", () => {
    expect(planReview(signal({ verdict: "unsure" }), { action: "marked_not_roster", reviewTopic: "other", reviewNote: "x".repeat(1001) })).toMatchObject({ ok: false, error: "noteTooLong" });
  });
});

describe("normalizeXHandle", () => {
  it("accepts handles and profile urls, lowercased", () => {
    expect(normalizeXHandle("@Team_GC")).toEqual({ ok: true, handle: "team_gc" });
    expect(normalizeXHandle("https://x.com/Team_GC?lang=en")).toEqual({ ok: true, handle: "team_gc" });
    expect(normalizeXHandle("twitter.com/Team_GC/")).toEqual({ ok: true, handle: "team_gc" });
  });

  it("rejects empty or invalid handles", () => {
    expect(normalizeXHandle("  ")).toEqual({ ok: false, error: "handleRequired" });
    expect(normalizeXHandle("x.com/home")).toEqual({ ok: false, error: "handleInvalid" });
    expect(normalizeXHandle("not a handle")).toEqual({ ok: false, error: "handleInvalid" });
    expect(normalizeXHandle("a".repeat(16))).toEqual({ ok: false, error: "handleInvalid" });
  });
});

describe("normalizeXHandle input", () => {
  it("rejects a non string value without throwing", () => {
    for (const value of [null, undefined, 12, {}]) expect(normalizeXHandle(value)).toEqual({ ok: false, error: "handleRequired" });
  });
});
