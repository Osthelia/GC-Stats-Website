/**
 * GC-Stats - dashboard-api-keys
 *
 * Dashboard server action letting an organization regenerate its own API
 * key. This is the only key lifecycle action left outside /admin; everything
 * else (create, rename, rate limit, activate, delete) is admin-only.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgActorPermission } from "@/lib/dashboard-rbac";
import { logActivity } from "@/lib/activity-log";
import { generatePlainApiKey, hashApiKey } from "@/lib/api-key-crypto";
import { invalidateApiKeyCache } from "@/lib/api/v1/auth";
import type { RegenerateApiKeyResult } from "@/lib/dashboard-api-keys";

export type { RegenerateApiKeyResult } from "@/lib/dashboard-api-keys";

/** Every key row this action touches must belong to this organization — guards against an actor with apiKeysManage on org A reaching a key id that actually belongs to org B. */
async function assertOwnedByOrganization(organizationId: number, id: number): Promise<string | null> {
  const [existing] = await db.select({ organizationId: apiKeys.organizationId, keyHash: apiKeys.keyHash }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return existing?.organizationId === organizationId ? existing.keyHash : null;
}

/**
 * Regeneration is the only lifecycle action left on /dashboard — creating,
 * renaming, changing the rate limit, activating/deactivating and deleting a
 * key are all admin-only (see actions/admin-api-keys.ts), per explicit
 * decision: an organization can rotate a leaked secret itself without
 * waiting on an admin, but everything else about a key's identity is set
 * when a GC Stats admin issues it.
 */
export async function regenerateOrganizationApiKey(organizationId: number, id: number): Promise<RegenerateApiKeyResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.apiKeysManage);
  const previousHash = await assertOwnedByOrganization(organizationId, id);
  if (!previousHash) return { ok: false, error: "notFound" };

  const plainKey = generatePlainApiKey();
  await db.transaction(async (tx) => {
    await tx.update(apiKeys).set({ keyHash: hashApiKey(plainKey) }).where(eq(apiKeys.id, id));
    await logActivity({ subject: "apiKey", subjectId: id, event: "updated", description: `Regenerated API key #${id}`, actorUserId, properties: { section: "regenerate", organizationId } }, tx);
  });
  invalidateApiKeyCache(previousHash);
  return { ok: true, plainKey };
}
