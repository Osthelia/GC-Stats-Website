import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./db-errors";

describe("isUniqueViolation", () => {
  it("matches the code and constraint on the error itself", () => {
    expect(isUniqueViolation({ code: "23505", constraint: "a_pkey" }, "a_pkey")).toBe(true);
  });

  it("finds them on a wrapped cause", () => {
    expect(isUniqueViolation(new Error("Failed query", { cause: { code: "23505", constraint: "a_pkey" } }), "a_pkey")).toBe(true);
  });

  it("refuses another constraint", () => {
    expect(isUniqueViolation({ code: "23505", constraint: "b_pkey" }, "a_pkey")).toBe(false);
  });

  it("refuses another kind of error, such as a check violation or a dropped connection", () => {
    expect(isUniqueViolation({ code: "23514", constraint: "a_pkey" }, "a_pkey")).toBe(false);
    expect(isUniqueViolation(new Error("Connection terminated"), "a_pkey")).toBe(false);
    expect(isUniqueViolation(null, "a_pkey")).toBe(false);
  });
});
