/**
 * GC-Stats - game-href
 *
 * Turns a game-less path ("/team/3/foo") into the path of a given game
 * ("/valorant/team/3/foo"). Pure and client-safe, shared by the link
 * components, the router wrapper and the proxy.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { GAMES, type GameSlug } from "@gc-stats/db/game";

const END = String.raw`(?=[/?#]|$)`;

// Public pages that exist once per game, under /{game}/...
export const PUBLIC_GAME_SEGMENTS = ["team", "player", "tournaments", "match", "news", "organization", "search", "widget"] as const;

const PUBLIC_RE = new RegExp(String.raw`^/(${PUBLIC_GAME_SEGMENTS.join("|")})${END}`);
const USER_NEWS_RE = new RegExp(String.raw`^/user/([^/?#]+)/news${END}`);
// Admin content sections, under /admin/{game}/...
const ADMIN_RE = new RegExp(String.raw`^/admin/(teams|players|tournaments|organizations|change-requests|point-types)${END}`);
// Dashboard sections that depend on the game, under /dashboard/{organizationId}/{game}/...
const DASHBOARD_ORG_RE = new RegExp(String.raw`^/dashboard/(\d+)/(news|streams|vods|veto|credits|members)${END}`);
// The author sections keep their game segment: a path that already has one is left alone.
const GAME_NEXT = `(?!/(${GAMES.join("|")})${END})`;
const DASHBOARD_AUTHOR_RE = new RegExp(String.raw`^/dashboard/(author|authors/\d+)${GAME_NEXT}(?!/profile${END})${END}`);

/** Path of `href` for `game`, unchanged when it is not a per-game page or already carries a game. */
export function withGame(href: string, game: GameSlug): string {
  if (PUBLIC_RE.test(href)) return `/${game}${href}`;
  if (USER_NEWS_RE.test(href)) return href.replace(/^\/user\//, `/${game}/user/`);
  if (ADMIN_RE.test(href)) return href.replace(/^\/admin\//, `/admin/${game}/`);
  const org = DASHBOARD_ORG_RE.exec(href);
  if (org) return href.replace(`/dashboard/${org[1]}/`, `/dashboard/${org[1]}/${game}/`);
  const author = DASHBOARD_AUTHOR_RE.exec(href);
  if (author) return href.replace(`/dashboard/${author[1]}`, `/dashboard/${author[1]}/${game}`);
  return href;
}

/** True when `href` is a per-game page still missing its game. */
export function needsGame(href: string): boolean {
  return withGame(href, "valorant") !== href;
}
