/**
 * GC-Stats - revoke-tokens
 *
 * Revokes every live OAuth access/refresh token matching a user and/or
 * client, and busts the access token cache so revocation is immediate.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, isNull, type SQL } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthAccessTokens, oauthRefreshTokens } from "@gc-stats/db";
import { invalidateAccessTokenCache } from "@/lib/oauth/token-resolve";

export async function revokeOAuthTokens(filter: { userId?: string; clientId?: number }): Promise<void> {
  if (filter.userId === undefined && filter.clientId === undefined) throw new Error("revokeOAuthTokens needs a filter");

  const accessConditions: SQL[] = [isNull(oauthAccessTokens.revokedAt)];
  const refreshConditions: SQL[] = [isNull(oauthRefreshTokens.revokedAt)];
  if (filter.userId !== undefined) {
    accessConditions.push(eq(oauthAccessTokens.userId, filter.userId));
    refreshConditions.push(eq(oauthRefreshTokens.userId, filter.userId));
  }
  if (filter.clientId !== undefined) {
    accessConditions.push(eq(oauthAccessTokens.clientId, filter.clientId));
    refreshConditions.push(eq(oauthRefreshTokens.clientId, filter.clientId));
  }

  const now = new Date();
  const revoked = await db
    .update(oauthAccessTokens)
    .set({ revokedAt: now })
    .where(and(...accessConditions))
    .returning({ tokenHash: oauthAccessTokens.tokenHash });
  await db.update(oauthRefreshTokens).set({ revokedAt: now }).where(and(...refreshConditions));

  for (const { tokenHash } of revoked) invalidateAccessTokenCache(tokenHash);
}
