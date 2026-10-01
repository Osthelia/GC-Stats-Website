/**
 * GC-Stats - handler
 *
 * Shared auth, rate limit and logging wrapper for every /api/v1 route,
 * mapping handler results and thrown ApiV1Error to the right HTTP status.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse, after } from "next/server";
import { db } from "@gc-stats/db/client";
import { apiRequestLog } from "@gc-stats/db";
import { resolveApiKey } from "./auth";
import { checkRateLimit } from "./rate-limit";

/** Thrown by a query/route to short-circuit `withApiV1` with a specific status (400 bad params, ...). */
export class ApiV1Error extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function logRequest(request: Request, endpointTemplate: string, apiKeyId: number | null, startedAt: number, statusCode: number) {
  if (apiKeyId == null) return;
  const durationMs = Date.now() - startedAt;
  const userAgent = request.headers.get("user-agent");
  const method = request.method;
  // Fire-and-forget, same fail-open style as lib/notify.ts's email send —
  // a logging failure must never take down the actual API response.
  after(() =>
    db
      .insert(apiRequestLog)
      .values({ apiKeyId, method, endpoint: endpointTemplate, statusCode, durationMs, userAgent })
      .catch((err) => console.error("Failed to log API v1 request", err)),
  );
}

/**
 * Auth (`x-api-key`) + rate limit + logging wrapper for every `/api/v1`
 * route. `endpointTemplate` is the route's path *shape* (e.g. "/v1/teams/:id"),
 * never the literal request path — `apiRequestLog.endpoint` is grouped by it
 * for the per-endpoint stats already built on /admin + /dashboard.
 *
 * `handler` returning `null` is treated as 404 (resource not found).
 * `cost` (default 1) is how much of the per-minute window this call consumes
 * — heavier endpoints (teams/players V2) charge more than 1.
 */
export async function withApiV1<T>(request: Request, endpointTemplate: string, handler: () => Promise<T | null>, cost = 1): Promise<NextResponse> {
  const startedAt = Date.now();
  const key = await resolveApiKey(request);
  if (!key) {
    return NextResponse.json({ error: "Missing or invalid x-api-key header" }, { status: 401 });
  }

  if (!(await checkRateLimit(key.id, key.rateLimit, cost))) {
    logRequest(request, endpointTemplate, key.id, startedAt, 429);
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const result = await handler();
    if (result === null) {
      logRequest(request, endpointTemplate, key.id, startedAt, 404);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    logRequest(request, endpointTemplate, key.id, startedAt, 200);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiV1Error) {
      logRequest(request, endpointTemplate, key.id, startedAt, err.status);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`API v1 error on ${endpointTemplate}`, err);
    logRequest(request, endpointTemplate, key.id, startedAt, 500);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
