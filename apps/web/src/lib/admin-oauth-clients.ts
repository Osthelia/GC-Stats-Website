/**
 * GC-Stats - admin-oauth-clients
 *
 * Admin query listing OAuth clients for /admin/oauth-clients, a bounded,
 * admin-managed list with no search or pagination.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc } from "drizzle-orm";
// adminDb: the panel must reflect an edit right after router.refresh(), the
// Hyperdrive-cached `db` would serve the pre-edit row for up to 60s.
import { adminDb as db } from "@gc-stats/db/client";
import { oauthClients } from "@gc-stats/db";
import type { OAuthScope } from "@/lib/oauth/scopes";

export type AdminOAuthClientRow = {
  id: number;
  name: string;
  clientId: string;
  isConfidential: boolean;
  redirectUris: string[];
  allowedScopes: OAuthScope[];
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
};

// Admin-managed, bounded list (no self-service creation, cf. SUIVI.md) — same
// "no sort/search/pagination" exception already accepted for /admin/about's
// config tables, not a listing that grows unbounded like matches/players.
export async function listAdminOAuthClients(): Promise<AdminOAuthClientRow[]> {
  const rows = await db.select().from(oauthClients).orderBy(asc(oauthClients.name));
  return rows.map((r) => ({ ...r, allowedScopes: r.allowedScopes as OAuthScope[] }));
}
