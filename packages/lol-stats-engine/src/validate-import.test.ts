/**
 * GC-Stats — validate-import.test module
 *
 * Unit tests for validateImport against a real exported LoL game, and against copies of it with one
 * thing broken.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateImport } from "./validate-import";

const fixturePath = fileURLToPath(new URL("./__fixtures__/lol-game-example.json", import.meta.url));
const game = JSON.parse(readFileSync(fixturePath, "utf-8"));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("validateImport (real LoL game)", () => {
  it("accepts a match with its timeline", () => {
    const result = validateImport(game.match, game.timeline);
    expect(result).toMatchObject({ ok: true });
  });

  it("accepts a match without a timeline (chronobreak)", () => {
    expect(validateImport(game.match, null)).toMatchObject({ ok: true, timeline: null });
  });

  it("rejects a timeline that is missing rather than null", () => {
    expect(validateImport(game.match, undefined)).toMatchObject({ ok: false });
  });

  it("rejects a timeline from another match", () => {
    const timeline = clone(game.timeline);
    timeline.metadata.matchId = "EUW1_1";
    const result = validateImport(game.match, timeline);
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining("timeline is for")] });
  });

  it("rejects a timeline whose participants are different players", () => {
    const timeline = clone(game.timeline);
    timeline.info.participants[0].puuid = "not-in-this-game";
    const result = validateImport(game.match, timeline);
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining("not the same ten puuids")] });
  });

  it("rejects a match with the wrong number of participants and says how many there are", () => {
    const match = clone(game.match);
    match.info.participants.pop();
    const result = validateImport(match, null);
    expect(result).toMatchObject({ ok: false, errors: [expect.stringContaining("has 9 entries, expected 10")] });
  });

  it("rejects something that is not a match at all", () => {
    expect(validateImport({ info: {} }, null)).toMatchObject({ ok: false });
    expect(validateImport("not json", null)).toMatchObject({ ok: false });
  });
});
