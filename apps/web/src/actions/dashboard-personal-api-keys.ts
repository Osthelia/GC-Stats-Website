/**
 * GC-Stats - dashboard-personal-api-keys
 *
 * Dashboard server action letting a user regenerate their own personal API
 * key. Personal-key mirror of dashboard-api-keys.ts's organization version.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys } from "@gc-stats/db";
import { requireApiKeyActor } from "@/lib/dashboard-rbac";
import { logActivity } from "@/lib/activity-log";
import { generatePlainApiKey, hashApiKey } from "@/lib/api-key-crypto";
import { invalidateApiKeyCache } from "@/lib/api/v1/auth";
import type { RegenerateApiKeyResult } from "@/lib/dashboard-api-keys";

export type { RegenerateApiKeyResult } from "@/lib/dashboard-api-keys";

/** Every key row this action touches must belong to this user — guards against an actor reaching a key id that belongs to someone else, or to an organization. */
async function assertOwnedByUser(userId: string, id: number): Promise<string | null> {
  const [existing] = await db.select({ userId: apiKeys.userId, keyHash: apiKeys.keyHash }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return existing?.userId === userId ? existing.keyHash : null;
}

/** Personal-key mirror of regenerateOrganizationApiKey — same "regenerate only, everything else is admin-only" rule (see actions/dashboard-api-keys.ts). */
export async function regeneratePersonalApiKey(id: number): Promise<RegenerateApiKeyResult> {
  const { userId } = await requireApiKeyActor();
  const previousHash = await assertOwnedByUser(userId, id);
  if (!previousHash) return { ok: false, error: "notFound" };

  const plainKey = generatePlainApiKey();
  await db.transaction(async (tx) => {
    await tx.update(apiKeys).set({ keyHash: hashApiKey(plainKey) }).where(eq(apiKeys.id, id));
    await logActivity({ subject: "apiKey", subjectId: id, event: "updated", description: `Regenerated personal API key #${id}`, actorUserId: userId, properties: { section: "regenerate" } }, tx);
  });
  invalidateApiKeyCache(previousHash);
  return { ok: true, plainKey };
}
