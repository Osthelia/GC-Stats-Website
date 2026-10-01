/**
 * GC-Stats - admin-oauth-clients
 *
 * Admin server actions managing registered OAuth clients: redirect URIs,
 * allowed scopes, and secret rotation via opaque token hashing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthClients, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/oauth/token-crypto";
import { invalidateOAuthClientCache } from "@/lib/oauth/client-auth";
import { revokeOAuthTokens } from "@/lib/oauth/revoke-tokens";
import { OAUTH_SCOPES, type OAuthScope } from "@/lib/oauth/scopes";

async function requireOAuthClientsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.oauthClientsManage);
}

export type OAuthClientField = "name" | "redirectUris" | "allowedScopes" | "logoUrl";
export type OAuthClientFieldErrors = Partial<Record<OAuthClientField, string>>;

export type OAuthClientInput = {
  name: string;
  redirectUris: string; // one per line, from a textarea
  allowedScopes: OAuthScope[];
  isConfidential: boolean;
  logoUrl: string;
};

function isValidRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

function validateOAuthClientInput(input: OAuthClientInput): { fieldErrors: OAuthClientFieldErrors; redirectUris: string[] } {
  const fieldErrors: OAuthClientFieldErrors = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 100) fieldErrors.name = "tooLong";

  const redirectUris = [...new Set(input.redirectUris.split("\n").map((line) => line.trim()).filter(Boolean))];
  if (redirectUris.length === 0) fieldErrors.redirectUris = "required";
  else if (redirectUris.some((uri) => !isValidRedirectUri(uri))) fieldErrors.redirectUris = "invalid";

  if (input.allowedScopes.length === 0) fieldErrors.allowedScopes = "required";
  else if (input.allowedScopes.some((s) => !(OAUTH_SCOPES as readonly string[]).includes(s))) fieldErrors.allowedScopes = "invalid";

  // https only: the logo loads on the consent screen, never over plain http.
  const logoUrl = input.logoUrl.trim();
  if (logoUrl) {
    try {
      if (new URL(logoUrl).protocol !== "https:") fieldErrors.logoUrl = "invalid";
    } catch {
      fieldErrors.logoUrl = "invalid";
    }
  }

  return { fieldErrors, redirectUris };
}

export type CreateOAuthClientResult = { ok: true; id: number; clientId: string; clientSecret: string | null } | { ok: false; fieldErrors: OAuthClientFieldErrors };

export async function createOAuthClient(input: OAuthClientInput): Promise<CreateOAuthClientResult> {
  await requireOAuthClientsActor();

  const { fieldErrors, redirectUris } = validateOAuthClientInput(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const clientId = generateOpaqueToken("gcs_client_");
  const plainSecret = input.isConfidential ? generateOpaqueToken("gcs_cs_") : null;

  const [created] = await db
    .insert(oauthClients)
    .values({
      name: input.name.trim(),
      clientId,
      clientSecretHash: plainSecret ? hashOpaqueToken(plainSecret) : null,
      isConfidential: input.isConfidential,
      redirectUris,
      allowedScopes: input.allowedScopes,
      logoUrl: input.logoUrl.trim() || null,
      isActive: true,
    })
    .returning({ id: oauthClients.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id, clientId, clientSecret: plainSecret };
}

export type UpdateOAuthClientResult = { ok: true } | { ok: false; fieldErrors: OAuthClientFieldErrors; error?: "notFound" };

export async function updateOAuthClient(id: number, input: OAuthClientInput): Promise<UpdateOAuthClientResult> {
  await requireOAuthClientsActor();

  const [existing] = await db.select({ clientId: oauthClients.clientId }).from(oauthClients).where(eq(oauthClients.id, id)).limit(1);
  if (!existing) return { ok: false, fieldErrors: {}, error: "notFound" };

  const { fieldErrors, redirectUris } = validateOAuthClientInput(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(oauthClients)
    // isConfidential is fixed at creation: flipping it would silently drop
    // (or break) the secret requirement of a live client.
    .set({
      name: input.name.trim(),
      redirectUris,
      allowedScopes: input.allowedScopes,
      logoUrl: input.logoUrl.trim() || null,
    })
    .where(eq(oauthClients.id, id));

  invalidateOAuthClientCache(existing.clientId);
  return { ok: true };
}

export type RegenerateOAuthClientSecretResult = { ok: true; clientSecret: string } | { ok: false; error: "notFound" | "publicClient" };

export async function regenerateOAuthClientSecret(id: number): Promise<RegenerateOAuthClientSecretResult> {
  await requireOAuthClientsActor();

  const [existing] = await db.select({ clientId: oauthClients.clientId, isConfidential: oauthClients.isConfidential }).from(oauthClients).where(eq(oauthClients.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (!existing.isConfidential) return { ok: false, error: "publicClient" };

  const plainSecret = generateOpaqueToken("gcs_cs_");
  await db.update(oauthClients).set({ clientSecretHash: hashOpaqueToken(plainSecret) }).where(eq(oauthClients.id, id));
  invalidateOAuthClientCache(existing.clientId);
  return { ok: true, clientSecret: plainSecret };
}

export type ToggleOAuthClientResult = { ok: true } | { ok: false; error: "notFound" };

export async function toggleOAuthClientActive(id: number, isActive: boolean): Promise<ToggleOAuthClientResult> {
  await requireOAuthClientsActor();

  const [existing] = await db.select({ clientId: oauthClients.clientId }).from(oauthClients).where(eq(oauthClients.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.update(oauthClients).set({ isActive }).where(eq(oauthClients.id, id));
  invalidateOAuthClientCache(existing.clientId);
  if (!isActive) await revokeOAuthTokens({ clientId: id });
  return { ok: true };
}

export type DeleteOAuthClientResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteOAuthClient(id: number): Promise<DeleteOAuthClientResult> {
  await requireOAuthClientsActor();

  const [existing] = await db.select({ clientId: oauthClients.clientId }).from(oauthClients).where(eq(oauthClients.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  // Revoked first so the access token cache is busted before the rows cascade away.
  await revokeOAuthTokens({ clientId: id });
  await db.delete(oauthClients).where(eq(oauthClients.id, id));
  invalidateOAuthClientCache(existing.clientId);
  return { ok: true };
}
