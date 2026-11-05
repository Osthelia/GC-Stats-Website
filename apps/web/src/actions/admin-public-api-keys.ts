/**
 * GC-Stats - admin-public-api-keys
 *
 * Admin moderation of public API keys: edit, suspend (only an admin lifts
 * it), delete, and block the owner's API access (every public key revoked,
 * no new one can be created). Public keys are never regenerated.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, users, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { validatePublicApiKeyFields, type PublicApiKeyFieldErrors } from "@/lib/public-api/config-shared";

export type AdminPublicApiKeyResult = { ok: true } | { ok: false; error: "notFound" | "invalid"; fieldErrors?: PublicApiKeyFieldErrors };

async function findPublicKey(id: unknown): Promise<{ id: number; userId: string | null; clientName: string } | null> {
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  const [row] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, clientName: apiKeys.clientName })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.kind, "public")))
    .limit(1);
  return row ?? null;
}

export async function updatePublicApiKey(id: unknown, input: { clientName: unknown; usageDescription: unknown }): Promise<AdminPublicApiKeyResult> {
  const { userId: actorUserId } = await requireActorPermission(PERMISSIONS.apiKeysManage);
  const key = await findPublicKey(id);
  if (!key) return { ok: false, error: "notFound" };

  const validated = validatePublicApiKeyFields(input);
  if (!validated.ok) return { ok: false, error: "invalid", fieldErrors: validated.fieldErrors };

  await db.update(apiKeys).set(validated.value).where(eq(apiKeys.id, key.id));
  await logActivity({ subject: "apiKey", subjectId: key.id, event: "updated", description: `Edited public API key #${key.id}`, actorUserId, properties: { kind: "public" } });
  return { ok: true };
}

export async function setPublicApiKeySuspended(id: unknown, suspended: unknown): Promise<AdminPublicApiKeyResult> {
  const { userId: actorUserId } = await requireActorPermission(PERMISSIONS.apiKeysManage);
  const key = await findPublicKey(id);
  if (!key || typeof suspended !== "boolean") return { ok: false, error: "notFound" };

  // `isActive` is left untouched, so lifting gives back the key's own state (active, revoked by its owner or by a block).
  await db.update(apiKeys).set({ suspendedAt: suspended ? new Date() : null }).where(eq(apiKeys.id, key.id));
  await logActivity({ subject: "apiKey", subjectId: key.id, event: "updated", description: `${suspended ? "Suspended" : "Lifted the suspension of"} public API key #${key.id}`, actorUserId, properties: { kind: "public", section: "suspension" } });
  return { ok: true };
}

export async function deletePublicApiKey(id: unknown): Promise<AdminPublicApiKeyResult> {
  const { userId: actorUserId } = await requireActorPermission(PERMISSIONS.apiKeysManage);
  const key = await findPublicKey(id);
  if (!key) return { ok: false, error: "notFound" };

  await db.delete(apiKeys).where(eq(apiKeys.id, key.id));
  await logActivity({ subject: "apiKey", subjectId: key.id, event: "deleted", description: `Deleted public API key #${key.id} (${key.clientName})`, actorUserId, properties: { kind: "public" } });
  return { ok: true };
}

/** Blocking revokes every public key of the user, unblocking only allows new keys again. */
export async function setUserApiAccessBlocked(userId: unknown, blocked: unknown): Promise<AdminPublicApiKeyResult> {
  const { userId: actorUserId } = await requireActorPermission(PERMISSIONS.apiKeysManage);
  if (typeof userId !== "string" || typeof blocked !== "boolean") return { ok: false, error: "notFound" };
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.update(users).set({ apiAccessBlockedAt: blocked ? new Date() : null }).where(eq(users.id, userId));
    if (blocked) await tx.update(apiKeys).set({ isActive: false }).where(and(eq(apiKeys.userId, userId), eq(apiKeys.kind, "public")));
    await logActivity({ subject: "user", subjectId: userId, event: "updated", description: blocked ? "Blocked API access (public keys revoked)" : "Unblocked API access", actorUserId, properties: { section: "apiAccess" } }, tx);
  });
  return { ok: true };
}
