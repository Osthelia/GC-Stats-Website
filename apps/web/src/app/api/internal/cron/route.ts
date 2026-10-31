/**
 * GC-Stats - route
 *
 * Internal cron dispatch endpoint, called by the Kubernetes CronJobs (one per
 * distinct cron expression, see gc-stats-cronjobs.yaml in the GitOps repo)
 * with the CRON_SECRET bearer token. Runs every job matching the expression.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runJobsForCron } from "@/lib/scheduled-jobs/jobs-list";

function isAuthorized(header: string | null, secret: string): boolean {
  const presented = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !isAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cron = new URL(request.url).searchParams.get("cron");
  if (!cron) {
    return NextResponse.json({ error: "missing cron param" }, { status: 400 });
  }

  await runJobsForCron(cron);
  return new NextResponse(null, { status: 204 });
}
