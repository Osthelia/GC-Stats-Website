/**
 * GC-Stats - route
 *
 * Team veto endpoint behind the secret veto link: GET polls the state of the
 * team's current match, POST plays an action on it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { checkRateLimitDb } from "@/lib/rate-limit-db";
import { getClientIp } from "@/lib/client-ip";
import { getTeamContext, performVetoAction } from "@/lib/veto/service";
import { getTeamVetoView } from "@/lib/veto/team-view";
import { parseVetoAction } from "@/lib/veto/parse-action";

type Params = { params: Promise<{ token: string }> };

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  if (!(await checkRateLimitDb(`veto-poll:${getClientIp(request.headers)}`, 10_000, 150))) return NextResponse.json({ error: "rateLimited" }, { status: 429, headers: NO_STORE });
  const requested = Number(new URL(request.url).searchParams.get("match"));
  const view = await getTeamVetoView(token, Number.isInteger(requested) && requested > 0 ? requested : null);
  if (!view) return NextResponse.json({ error: "notFound" }, { status: 404, headers: NO_STORE });
  return NextResponse.json(view, { headers: NO_STORE });
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const allowed = await checkRateLimitDb(`veto-action:${getClientIp(request.headers)}`, 10_000, 30);
  if (!allowed) return NextResponse.json({ error: "rateLimited" }, { status: 429, headers: NO_STORE });

  const context = await getTeamContext(token);
  if (!context) return NextResponse.json({ error: "notFound" }, { status: 404, headers: NO_STORE });

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseVetoAction(body);
  if (!parsed) return NextResponse.json({ error: "invalidRequest" }, { status: 400, headers: NO_STORE });

  const result = await performVetoAction(context.entrantId, parsed.matchId, parsed.action);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "notFound" || result.error === "notAllowed" ? 404 : 409, headers: NO_STORE });
  return NextResponse.json({ state: result.state }, { headers: NO_STORE });
}
