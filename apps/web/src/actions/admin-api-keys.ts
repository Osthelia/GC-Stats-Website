/**
 * GC-Stats - admin-api-keys
 *
 * Admin server actions for API key management. Creation is admin-only for
 * every key, personal or organization-scoped; organizations can only
 * view/regenerate their own keys from the dashboard.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, users, organizations, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission, requireActorAccess } from "@/lib/rbac";
import { generatePlainApiKey, hashApiKey } from "@/lib/api-key-crypto";
import { invalidateApiKeyCache } from "@/lib/api/v1/auth";
import { searchOrganizationsQuery, type OrganizationPickerResult } from "@/lib/organization-search";

async function requireApiKeysActor(): Promise<void> {
  // Re-checked here, not just relied on from the /admin layout guard — a
  // server action is reachable as its own POST endpoint regardless of which
  // page rendered the form that calls it.
  await requireActorPermission(PERMISSIONS.apiKeysManage);
}

export type ApiKeyField = "clientName" | "rateLimit";
export type ApiKeyFieldErrors = Partial<Record<ApiKeyField, string>>;

export type ApiKeyInput = { clientName: string; rateLimit: string };

function validateApiKeyInput(input: ApiKeyInput): { fieldErrors: ApiKeyFieldErrors; rateLimitNum: number | null } {
  const fieldErrors: ApiKeyFieldErrors = {};

  const clientName = input.clientName.trim();
  if (!clientName) fieldErrors.clientName = "required";
  else if (clientName.length > 100) fieldErrors.clientName = "tooLong";

  let rateLimitNum: number | null = null;
  const rateLimitTrim = input.rateLimit.trim();
  if (rateLimitTrim !== "") {
    rateLimitNum = Number(rateLimitTrim);
    if (!Number.isInteger(rateLimitNum) || rateLimitNum <= 0 || rateLimitNum > 1_000_000) {
      fieldErrors.rateLimit = "invalid";
    }
  }

  return { fieldErrors, rateLimitNum };
}

export type ApiKeyOwner = { type: "user"; userId: string } | { type: "organization"; organizationId: number };

export type CreateApiKeyResult =
  | { ok: true; id: number; plainKey: string }
  | { ok: false; fieldErrors: ApiKeyFieldErrors; error?: "userNotFound" | "organizationNotFound" };

/**
 * Creation is admin-only for every key, personal or org-scoped — organizations
 * lost self-service creation from /dashboard (they only regenerate/view
 * their own keys now), so this is the only place a key comes into existence.
 */
export async function createApiKey(owner: ApiKeyOwner, input: ApiKeyInput): Promise<CreateApiKeyResult> {
  await requireApiKeysActor();

  if (owner.type === "user") {
    const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, owner.userId)).limit(1);
    if (!targetUser) return { ok: false, fieldErrors: {}, error: "userNotFound" };
  } else {
    const [targetOrg] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, owner.organizationId)).limit(1);
    if (!targetOrg) return { ok: false, fieldErrors: {}, error: "organizationNotFound" };
  }

  const { fieldErrors, rateLimitNum } = validateApiKeyInput(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const plainKey = generatePlainApiKey();
  const [created] = await db
    .insert(apiKeys)
    .values({
      userId: owner.type === "user" ? owner.userId : null,
      organizationId: owner.type === "organization" ? owner.organizationId : null,
      clientName: input.clientName.trim(),
      keyHash: hashApiKey(plainKey),
      rateLimit: rateLimitNum,
      isActive: true,
    })
    .returning({ id: apiKeys.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id, plainKey };
}

/** Typo-tolerant organization search backing OrganizationPicker in the create-key dialog. */
export async function searchOrganizationsForApiKey(query: string): Promise<OrganizationPickerResult[]> {
  await requireActorAccess();
  return searchOrganizationsQuery(query);
}

export type UpdateApiKeyResult = { ok: true } | { ok: false; fieldErrors: ApiKeyFieldErrors; error?: "notFound" };

export async function updateApiKeyMeta(id: number, input: ApiKeyInput): Promise<UpdateApiKeyResult> {
  await requireApiKeysActor();

  const [existing] = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  if (!existing) return { ok: false, fieldErrors: {}, error: "notFound" };

  const { fieldErrors, rateLimitNum } = validateApiKeyInput(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.update(apiKeys).set({ clientName: input.clientName.trim(), rateLimit: rateLimitNum }).where(eq(apiKeys.id, id));
  return { ok: true };
}

export type RegenerateApiKeyResult = { ok: true; plainKey: string } | { ok: false; error: "notFound" };

export async function regenerateApiKey(id: number): Promise<RegenerateApiKeyResult> {
  await requireApiKeysActor();

  const [existing] = await db.select({ keyHash: apiKeys.keyHash }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const plainKey = generatePlainApiKey();
  await db.update(apiKeys).set({ keyHash: hashApiKey(plainKey) }).where(eq(apiKeys.id, id));
  invalidateApiKeyCache(existing.keyHash);
  return { ok: true, plainKey };
}

export type ToggleApiKeyResult = { ok: true } | { ok: false; error: "notFound" };

export async function toggleApiKeyActive(id: number, isActive: boolean): Promise<ToggleApiKeyResult> {
  await requireApiKeysActor();

  const [existing] = await db.select({ keyHash: apiKeys.keyHash }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.update(apiKeys).set({ isActive }).where(eq(apiKeys.id, id));
  invalidateApiKeyCache(existing.keyHash);
  return { ok: true };
}

export type DeleteApiKeyResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteApiKey(id: number): Promise<DeleteApiKeyResult> {
  await requireApiKeysActor();

  const [existing] = await db.select({ keyHash: apiKeys.keyHash }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  invalidateApiKeyCache(existing.keyHash);
  return { ok: true };
}
