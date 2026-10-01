/**
 * GC-Stats - oauth-connections
 *
 * Server action letting a user revoke an OAuth app's access from
 * /settings/connections: deletes the consent and revokes every active
 * access/refresh token, not just future authorizations.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthConsents } from "@gc-stats/db";
import { getCurrentUserId } from "@/lib/session";
import { revokeOAuthTokens } from "@/lib/oauth/revoke-tokens";

export type RevokeOAuthConsentResult = { ok: true } | { ok: false; error: "unauthenticated" | "notFound" };

/** User-initiated revoke from /settings/connections — deletes the consent and kills every active token this client holds for this user, not just future authorizations. */
export async function revokeOAuthConsent(clientId: number): Promise<RevokeOAuthConsentResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "unauthenticated" };

  const deleted = await db.delete(oauthConsents).where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.clientId, clientId))).returning({ id: oauthConsents.id });
  if (deleted.length === 0) return { ok: false, error: "notFound" };

  await revokeOAuthTokens({ userId, clientId });

  return { ok: true };
}
