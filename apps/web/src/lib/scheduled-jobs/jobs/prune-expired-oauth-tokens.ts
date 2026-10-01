/**
 * GC-Stats - prune-expired-oauth-tokens
 *
 * Scheduled job: deletes expired OAuth authorization codes and
 * expired/long-revoked access/refresh tokens. Revoked tokens are kept for
 * 7 days first as a reuse-detection audit trail.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { lt, or, and, isNotNull, lte } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { oauthAuthorizationCodes, oauthAccessTokens, oauthRefreshTokens } from "@gc-stats/db";

/** Deletes expired authorization codes and expired/long-revoked access/refresh tokens so these tables don't grow unbounded — mirrors prune-api-key-reveals. Revoked rows are kept for 7 days (reuse-detection audit trail) before being pruned. */
export async function pruneExpiredOAuthTokens(): Promise<string> {
  const now = new Date();
  const revokedCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const codes = await db.delete(oauthAuthorizationCodes).where(lt(oauthAuthorizationCodes.expiresAt, now)).returning({ id: oauthAuthorizationCodes.id });
  const accessTokens = await db
    .delete(oauthAccessTokens)
    .where(or(lt(oauthAccessTokens.expiresAt, now), and(isNotNull(oauthAccessTokens.revokedAt), lte(oauthAccessTokens.revokedAt, revokedCutoff))))
    .returning({ id: oauthAccessTokens.id });
  const refreshTokens = await db
    .delete(oauthRefreshTokens)
    .where(or(lt(oauthRefreshTokens.expiresAt, now), and(isNotNull(oauthRefreshTokens.revokedAt), lte(oauthRefreshTokens.revokedAt, revokedCutoff))))
    .returning({ id: oauthRefreshTokens.id });

  if (codes.length === 0 && accessTokens.length === 0 && refreshTokens.length === 0) return "no expired OAuth tokens to prune";
  return `pruned ${codes.length} authorization code(s), ${accessTokens.length} access token(s), ${refreshTokens.length} refresh token(s)`;
}
