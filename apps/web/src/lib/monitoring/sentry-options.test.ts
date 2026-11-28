import { describe, expect, it } from "vitest";
import { parseSampleRate, redactSecretPaths } from "./sentry-options";

describe("redactSecretPaths", () => {
  it("removes veto tokens wherever they appear in an event", () => {
    const event = { request: { url: "https://x.test/en/veto/abc123" }, breadcrumbs: [{ data: { to: "/api/veto/abc123?a=1" } }] };
    expect(redactSecretPaths(event)).toEqual({
      request: { url: "https://x.test/en/veto/[redacted]" },
      breadcrumbs: [{ data: { to: "/api/veto/[redacted]?a=1" } }],
    });
  });

  it("keeps route templates and copes with cycles", () => {
    const event: Record<string, unknown> = { transaction: "GET /[locale]/veto/[token]" };
    event.self = event;
    expect(redactSecretPaths(event).transaction).toBe("GET /[locale]/veto/[token]");
  });
});

describe("parseSampleRate", () => {
  it("accepts rates above 0 up to 1 only", () => {
    expect(parseSampleRate("0.25")).toBe(0.25);
    for (const raw of [undefined, "", "0", "2", "abc"]) expect(parseSampleRate(raw)).toBeUndefined();
  });
});
