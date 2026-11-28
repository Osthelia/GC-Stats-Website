import { describe, expect, it, vi } from "vitest";

vi.mock("@gc-stats/db/client", () => ({ adminDb: {} }));

import { isAccountTaken } from "./lol-accounts";

describe("isAccountTaken", () => {
  it("is true for a unique violation on the PUUID key, wrapped or not", () => {
    expect(isAccountTaken({ code: "23505", constraint: "lol_person_accounts_pkey" })).toBe(true);
    expect(isAccountTaken(new Error("Failed query", { cause: { code: "23505", constraint: "lol_person_accounts_pkey" } }))).toBe(true);
  });

  it("is false for any other failure", () => {
    expect(isAccountTaken({ code: "23505", constraint: "people_user_id_unique" })).toBe(false);
    expect(isAccountTaken({ code: "23514", constraint: "lol_person_accounts_source_check" })).toBe(false);
    expect(isAccountTaken(new Error("Connection terminated unexpectedly"))).toBe(false);
  });
});
