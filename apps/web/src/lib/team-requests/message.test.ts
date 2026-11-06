import { describe, expect, it } from "vitest";
import { buildTeamRequestMessage } from "./message";

const base = {
  teamName: "Team A",
  roster: [
    { handle: "Ann", role: "player-igl" },
    { handle: "Bea", role: "player" },
    { handle: "Cat", role: "sub" },
    { handle: "Bob", role: "coach" },
  ],
  unlistedPlayers: [],
  signature: { name: "Lacy", role: "Admin" },
};

describe("buildTeamRequestMessage", () => {
  it("only asks for the items flagged red", () => {
    const text = buildTeamRequestMessage({ ...base, items: new Set(["logo", "twitter", "discord"]) });
    expect(text).toContain("We do not have your logo");
    expect(text).toContain("Twitter, Discord");
    expect(text).toContain("Are you on any of these social networks");
    expect(text).not.toContain("Does it match your current lineup");
  });

  it("signs with the staff pseudo and role", () => {
    expect(buildTeamRequestMessage({ ...base, items: new Set(["logo"]) }).endsWith("Kind regards,\nLacy\nAdmin, GC Stats")).toBe(true);
    expect(buildTeamRequestMessage({ ...base, signature: { name: "Lacy", role: null }, items: new Set(["logo"]) }).endsWith("Lacy\nGC Stats")).toBe(true);
  });

  it("groups the roster by role, one line each", () => {
    const text = buildTeamRequestMessage({ ...base, items: new Set(["roster"]), unlistedPlayers: [{ handle: "Cid", matches: 3 }] });
    expect(text).toContain("Players: Ann (IGL), Bea\nSubs: Cat\nStaff: Bob (coach)");
    expect(text).toContain("• Cid (3 matches)");
  });

  it("skips empty role groups", () => {
    const text = buildTeamRequestMessage({ ...base, roster: [{ handle: "Ann", role: "player" }], items: new Set(["roster"]) });
    expect(text).toContain("Players: Ann");
    expect(text).not.toContain("Subs:");
    expect(text).not.toContain("Staff:");
  });
});
