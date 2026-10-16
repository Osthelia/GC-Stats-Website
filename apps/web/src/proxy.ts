/**
 * GC-Stats - Proxy utilities
 *
 * i18n routing middleware (Next.js 16 renamed the "middleware" file
 * convention to "proxy"), matches all routes except API, internal Next.js
 * assets, and files with an extension. Also sends game-less URLs of
 * per-game pages ("/team/3") to the game the visitor browsed last, and
 * remembers the game of the page being visited.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_GAME, isGameSlug } from "@gc-stats/db/game";
import { routing } from "./i18n/routing";
import { withGame } from "./lib/game-href";

const GAME_COOKIE = "gcs-game";
const GAME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const parts = pathname.split("/").filter(Boolean);
  const locale = parts[0] && (routing.locales as readonly string[]).includes(parts[0]) ? parts[0] : null;
  const segments = locale ? parts.slice(1) : parts;
  const rest = "/" + segments.join("/");

  const cookieGame = request.cookies.get(GAME_COOKIE)?.value;
  const preferred = isGameSlug(cookieGame) ? cookieGame : DEFAULT_GAME;
  const completed = withGame(rest, preferred);
  if (completed !== rest) {
    const url = request.nextUrl.clone();
    url.pathname = (locale ? `/${locale}` : "") + completed;
    url.search = search;
    return NextResponse.redirect(url, 307);
  }

  const response = intlMiddleware(request);
  const visited = segments[0] === "admin" ? segments[1] : segments[0];
  if (isGameSlug(visited) && visited !== cookieGame) {
    response.cookies.set(GAME_COOKIE, visited, { path: "/", maxAge: GAME_COOKIE_MAX_AGE, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
