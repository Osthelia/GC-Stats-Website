/**
 * GC-Stats - public-api-keys
 *
 * Server actions of /settings/api: an account creates and revokes its own
 * public API keys. A revoked key stays listed, inactive, and cannot be
 * turned back on.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, isNull } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, users } from "@gc-stats/db";
import { getCurrentUserId } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { generatePlainApiKey, hashApiKey } from "@/lib/api-key-crypto";
import { getPublicApiConfig } from "@/lib/public-api/config";
import { validatePublicApiKeyFields, type PublicApiKeyFieldErrors } from "@/lib/public-api/config-shared";
import { countUsedPublicApiKeySlots } from "@/lib/public-api-keys";

export type CreatePublicApiKeyResult =
  | { ok: true; plainKey: string }
  | { ok: false; error: "unauthenticated" | "disabled" | "blocked" | "tooManyKeys" | "invalid"; fieldErrors?: PublicApiKeyFieldErrors; max?: number };
export type RevokePublicApiKeyResult = { ok: true } | { ok: false; error: "unauthenticated" | "notFound" };

export async function createPublicApiKey(input: { clientName: unknown; usageDescription: unknown }): Promise<CreatePublicApiKeyResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "unauthenticated" };

  const validated = validatePublicApiKeyFields(input);
  if (!validated.ok) return { ok: false, error: "invalid", fieldErrors: validated.fieldErrors };

  const config = await getPublicApiConfig();
  if (!config.enabled) return { ok: false, error: "disabled" };

  const { clientName, usageDescription } = validated.value;
  const plainKey = generatePlainApiKey();
  return db.transaction(async (tx): Promise<CreatePublicApiKeyResult> => {
    // Locking the user row serializes concurrent creations (and a block), so the slot count holds.
    const [owner] = await tx.select({ blockedAt: users.apiAccessBlockedAt }).from(users).where(eq(users.id, userId)).for("update");
    if (!owner) return { ok: false, error: "unauthenticated" };
    if (owner.blockedAt) return { ok: false, error: "blocked" };
    if ((await countUsedPublicApiKeySlots(userId, tx)) >= config.maxKeysPerUser) return { ok: false, error: "tooManyKeys", max: config.maxKeysPerUser };

    const [row] = await tx.insert(apiKeys).values({ userId, clientName, usageDescription, keyHash: hashApiKey(plainKey), kind: "public" }).returning({ id: apiKeys.id });
    if (!row) throw new Error("public API key insert returned no row");
    await logActivity({ subject: "apiKey", subjectId: row.id, event: "created", description: `Created public API key #${row.id} (${clientName})`, actorUserId: userId, properties: { kind: "public" } }, tx);
    return { ok: true, plainKey };
  });
}

export async function revokePublicApiKey(id: unknown): Promise<RevokePublicApiKeyResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "unauthenticated" };
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return { ok: false, error: "notFound" };

  const updated = await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), eq(apiKeys.kind, "public"), isNull(apiKeys.suspendedAt)))
    .returning({ id: apiKeys.id });
  if (updated.length === 0) return { ok: false, error: "notFound" };

  await logActivity({ subject: "apiKey", subjectId: id, event: "updated", description: `Revoked public API key #${id}`, actorUserId: userId, properties: { kind: "public", section: "revoke" } });
  return { ok: true };
}
