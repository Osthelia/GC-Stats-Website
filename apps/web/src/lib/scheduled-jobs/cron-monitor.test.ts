import { afterEach, describe, expect, it, vi } from "vitest";

const captureCheckIn = vi.hoisted(() => vi.fn(() => "check-in-id"));
vi.mock("@sentry/nextjs", () => ({ captureCheckIn }));

import { cronMonitors, startCronCheckIn } from "./cron-monitor";

afterEach(() => {
  vi.unstubAllEnvs();
  captureCheckIn.mockClear();
});

describe("startCronCheckIn", () => {
  it("sends nothing when monitoring is off", () => {
    vi.stubEnv("SENTRY_CRON_MONITORS", "");
    startCronCheckIn("* * * * *")("ok");
    expect(captureCheckIn).not.toHaveBeenCalled();
  });

  it("ignores an unknown cron expression", () => {
    vi.stubEnv("SENTRY_CRON_MONITORS", "true");
    startCronCheckIn("1 2 3 4 5")("ok");
    expect(captureCheckIn).not.toHaveBeenCalled();
  });

  it("opens then closes the check-in of a run", () => {
    vi.stubEnv("SENTRY_CRON_MONITORS", "true");
    startCronCheckIn("* * * * *")("error");
    expect(captureCheckIn).toHaveBeenNthCalledWith(
      1,
      { monitorSlug: cronMonitors["* * * * *"]?.slug, status: "in_progress" },
      expect.objectContaining({ schedule: { type: "crontab", value: "* * * * *" } }),
    );
    expect(captureCheckIn).toHaveBeenNthCalledWith(2, expect.objectContaining({ checkInId: "check-in-id", status: "error" }));
  });
});
