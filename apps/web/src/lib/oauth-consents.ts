/**
 * GC-Stats - oauth-consents
 *
 * Backs /settings/connections: lists every third-party OAuth client a user
 * has granted consent to, with the scopes actually granted.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthConsents, oauthClients } from "@gc-stats/db";
import type { OAuthScope } from "@/lib/oauth/scopes";

export type ConnectedAppRow = {
  clientId: number;
  name: string;
  logoUrl: string | null;
  scopes: OAuthScope[];
  createdAt: Date;
};

/** Backs /settings/connections — every third-party client a user has granted consent to. */
export async function listUserOAuthConsents(userId: string): Promise<ConnectedAppRow[]> {
  const rows = await db
    .select({ clientId: oauthConsents.clientId, name: oauthClients.name, logoUrl: oauthClients.logoUrl, scopes: oauthConsents.scopes, createdAt: oauthConsents.createdAt })
    .from(oauthConsents)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthConsents.clientId))
    .where(eq(oauthConsents.userId, userId));

  return rows.map((r) => ({ ...r, scopes: r.scopes as OAuthScope[] }));
}
