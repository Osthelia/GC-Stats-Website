/**
 * GC-Stats - scope-list
 *
 * OAuth scope constants and parsing, no `db` import on purpose: client
 * components (oauth-client-dialog, oauth-consent-screen,
 * connected-apps-settings) need OAUTH_SCOPES/OAuthScope, and importing a
 * value from a module that touches `db` pulls `pg` into the client bundle.
 * lib/oauth/scopes.ts (server-only, resolves claims) re-exports these.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const OAUTH_SCOPES = ["profile", "email", "linked_accounts", "player", "teams", "org", "link_player"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export function isOAuthScope(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value);
}

/** Parses a space-separated `scope` param, keeping only known scopes (unknown ones are silently dropped, never rejected — mirrors OAuth spec behavior for optional scopes). */
export function parseScopeParam(scope: string | null): OAuthScope[] {
  if (!scope) return [];
  const seen = new Set<OAuthScope>();
  for (const raw of scope.split(/\s+/).filter(Boolean)) {
    if (isOAuthScope(raw)) seen.add(raw);
  }
  return [...seen];
}
