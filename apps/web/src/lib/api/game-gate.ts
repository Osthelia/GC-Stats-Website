/**
 * GC-Stats - game-gate
 *
 * The check every API route runs for a game that is not public yet (`PUBLIC_GAMES`): the 404 response, or
 * null when the request may go on. The public API and feeds serve outside consumers and caches, so they
 * use `publicGameGate` (no preview); the routes the site itself calls use `viewableGameGate`, which lets
 * admins of a hidden game through.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import type { GameSlug } from "@gc-stats/db/game";
import { isGamePublic, isHiddenGamePath } from "@/lib/public-games";
import { canViewGame } from "@/lib/rbac";

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** 404 unless `game` is public. */
export function publicGameGate(game: GameSlug): NextResponse | null {
  return isGamePublic(game) ? null : notFound();
}

/** 404 when the request's path holds a game that is not public yet (see isHiddenGamePath). */
export function hiddenGamePathGate(request: Request): NextResponse | null {
  return isHiddenGamePath(new URL(request.url).pathname) ? notFound() : null;
}

/** 404 unless `game` is public or the viewer is an admin of it. */
export async function viewableGameGate(game: GameSlug): Promise<NextResponse | null> {
  return (await canViewGame(game)) ? null : notFound();
}
