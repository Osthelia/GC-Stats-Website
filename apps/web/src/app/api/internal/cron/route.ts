/**
 * GC-Stats - route
 *
 * Internal cron dispatch endpoint, triggered by custom-worker.ts's scheduled()
 * handler via an internal handler.fetch() call, never over the public network.
 * Going through a real route (instead of calling runJobsForCron directly from
 * scheduled()) is required on Cloudflare Workers: getCloudflareContext() only
 * works inside the request context that OpenNext's own fetch wrapper sets up,
 * which a bare scheduled() call never gets.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
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
