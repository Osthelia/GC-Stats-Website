/**
 * GC-Stats - webhooks
 *
 * Dashboard server actions managing the webhook endpoints of a partner API
 * key: the personal key owner, or a member of the owning organization with
 * the API keys permission. Public keys have no webhooks.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import crypto from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, teams, webhookDeliveries, webhookEndpoints, ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireApiKeyActor, requireDashboardOrgActorPermission } from "@/lib/dashboard-rbac";
import { logActivity } from "@/lib/activity-log";
import { decrypt, encrypt } from "@/lib/encryption";
import { sendDeliveryNow, sendTestPing } from "@/lib/webhooks/dispatch";
import { listWebhookRegions } from "@/lib/webhooks/endpoints";
import { getCurrentUserId } from "@/lib/session";
import { searchTeamsQuery } from "@/lib/team-search";
import type { TeamPickerResult } from "@/lib/team-search";
import { validateWebhookUrl, type WebhookUrlError } from "@/lib/webhooks/url-guard";
import { WEBHOOK_LIMITS, WEBHOOK_OFFICIAL_FILTERS, isWebhookEvent, type WebhookEvent, type WebhookKeyScope, type WebhookOfficialFilter } from "@/lib/webhooks/shared";

export type WebhookEndpointInput = {
  url: unknown;
  description: unknown;
  events: unknown;
  filterRegions: unknown;
  filterTeamIds: unknown;
  filterOfficial: unknown;
};

export type WebhookFieldErrors = Partial<{
  url: WebhookUrlError;
  description: "tooLong";
  events: "required" | "invalid";
  filterRegions: "invalid" | "tooMany";
  filterTeamIds: "invalid" | "tooMany" | "unknownTeam";
  filterOfficial: "invalid";
}>;

type ActionError = "notFound" | "tooManyEndpoints" | "invalid" | "keyInactive";
export type SaveWebhookResult = { ok: true; secret?: string } | { ok: false; error: ActionError; fieldErrors?: WebhookFieldErrors };
export type WebhookSimpleResult = { ok: true } | { ok: false; error: "notFound" };
export type WebhookSecretResult = { ok: true; secret: string } | { ok: false; error: "notFound" };
export type WebhookSendResult = { ok: true; delivered: boolean; statusCode: number | null; error: string | null } | { ok: false; error: "notFound" | "busy" };

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString("base64url")}`;
}

/** Checks the actor may manage this partner key, throws when not signed in or not allowed. */
async function authorizeKey(scope: WebhookKeyScope): Promise<{ userId: string; keyActive: boolean } | null> {
  if (!Number.isInteger(scope.apiKeyId) || scope.apiKeyId <= 0) return null;
  const actor = scope.organizationId != null ? await requireDashboardOrgActorPermission(scope.organizationId, ORGANIZATION_PERMISSIONS.apiKeysManage) : await requireApiKeyActor();
  const [key] = await db.select({ userId: apiKeys.userId, organizationId: apiKeys.organizationId, kind: apiKeys.kind, isActive: apiKeys.isActive }).from(apiKeys).where(eq(apiKeys.id, scope.apiKeyId)).limit(1);
  if (!key || key.kind !== "partner") return null;
  const owned = scope.organizationId != null ? key.organizationId === scope.organizationId : key.userId === actor.userId;
  return owned ? { userId: actor.userId, keyActive: key.isActive } : null;
}

async function findEndpoint(apiKeyId: number, endpointId: unknown) {
  if (typeof endpointId !== "number" || !Number.isInteger(endpointId) || endpointId <= 0) return null;
  const [row] = await db
    .select({ id: webhookEndpoints.id, url: webhookEndpoints.url, secretEncrypted: webhookEndpoints.secretEncrypted })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.apiKeyId, apiKeyId)))
    .limit(1);
  return row ?? null;
}

type ValidEndpoint = { url: string; description: string | null; events: WebhookEvent[]; filterRegions: string[]; filterTeamIds: number[]; filterOfficial: WebhookOfficialFilter };

async function validateInput(input: WebhookEndpointInput): Promise<{ ok: true; value: ValidEndpoint } | { ok: false; fieldErrors: WebhookFieldErrors }> {
  const fieldErrors: WebhookFieldErrors = {};

  const url = validateWebhookUrl(input.url);
  if (!url.ok) fieldErrors.url = url.error;

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > WEBHOOK_LIMITS.descriptionMaxLength) fieldErrors.description = "tooLong";

  const events = Array.isArray(input.events) ? input.events : null;
  if (!events || events.length === 0) fieldErrors.events = "required";
  else if (!events.every(isWebhookEvent)) fieldErrors.events = "invalid";

  const regions = Array.isArray(input.filterRegions) ? input.filterRegions : null;
  if (!regions || !regions.every((r) => typeof r === "string")) fieldErrors.filterRegions = "invalid";
  else if (regions.length > WEBHOOK_LIMITS.filterRegions) fieldErrors.filterRegions = "tooMany";
  else if (regions.length > 0) {
    const known = new Set(await listWebhookRegions());
    if (!regions.every((r) => known.has(r as string))) fieldErrors.filterRegions = "invalid";
  }

  const teamIds = Array.isArray(input.filterTeamIds) ? input.filterTeamIds : null;
  if (!teamIds || !teamIds.every((id) => typeof id === "number" && Number.isInteger(id) && id > 0)) fieldErrors.filterTeamIds = "invalid";
  else if (teamIds.length > WEBHOOK_LIMITS.filterTeams) fieldErrors.filterTeamIds = "tooMany";
  else if (teamIds.length > 0) {
    const unique = [...new Set(teamIds as number[])];
    const found = await db.select({ id: teams.id }).from(teams).where(and(inArray(teams.id, unique), eq(teams.isGhost, false)));
    if (found.length !== unique.length) fieldErrors.filterTeamIds = "unknownTeam";
  }

  if (!(WEBHOOK_OFFICIAL_FILTERS as readonly unknown[]).includes(input.filterOfficial)) fieldErrors.filterOfficial = "invalid";

  if (Object.keys(fieldErrors).length > 0 || !url.ok) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      url: url.url,
      description: description || null,
      events: [...new Set(events as WebhookEvent[])],
      filterRegions: [...new Set(regions as string[])],
      filterTeamIds: [...new Set(teamIds as number[])],
      filterOfficial: input.filterOfficial as WebhookOfficialFilter,
    },
  };
}

export async function createWebhookEndpoint(scope: WebhookKeyScope, input: WebhookEndpointInput): Promise<SaveWebhookResult> {
  const actor = await authorizeKey(scope);
  if (!actor) return { ok: false, error: "notFound" };
  // Deactivating a key deletes its webhooks, none can be added back meanwhile.
  if (!actor.keyActive) return { ok: false, error: "keyInactive" };

  const validated = await validateInput(input);
  if (!validated.ok) return { ok: false, error: "invalid", fieldErrors: validated.fieldErrors };

  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(webhookEndpoints).where(eq(webhookEndpoints.apiKeyId, scope.apiKeyId));
  if (total >= WEBHOOK_LIMITS.endpointsPerKey) return { ok: false, error: "tooManyEndpoints" };

  const secret = generateSecret();
  const [row] = await db
    .insert(webhookEndpoints)
    .values({ apiKeyId: scope.apiKeyId, ...validated.value, secretEncrypted: encrypt(secret) })
    .returning({ id: webhookEndpoints.id });
  if (!row) throw new Error("webhook endpoint insert returned no row");
  await logActivity({ subject: "apiKey", subjectId: scope.apiKeyId, event: "updated", description: `Created webhook #${row.id} on API key #${scope.apiKeyId}`, actorUserId: actor.userId, properties: { section: "webhook", webhookId: row.id } });
  return { ok: true, secret };
}

export async function updateWebhookEndpoint(scope: WebhookKeyScope, endpointId: unknown, input: WebhookEndpointInput): Promise<SaveWebhookResult> {
  const actor = await authorizeKey(scope);
  const endpoint = actor ? await findEndpoint(scope.apiKeyId, endpointId) : null;
  if (!actor || !endpoint) return { ok: false, error: "notFound" };

  const validated = await validateInput(input);
  if (!validated.ok) return { ok: false, error: "invalid", fieldErrors: validated.fieldErrors };

  await db.update(webhookEndpoints).set({ ...validated.value, updatedAt: new Date() }).where(eq(webhookEndpoints.id, endpoint.id));
  await logActivity({ subject: "apiKey", subjectId: scope.apiKeyId, event: "updated", description: `Updated webhook #${endpoint.id} on API key #${scope.apiKeyId}`, actorUserId: actor.userId, properties: { section: "webhook", webhookId: endpoint.id } });
  return { ok: true };
}

export async function setWebhookEndpointActive(scope: WebhookKeyScope, endpointId: unknown, active: unknown): Promise<WebhookSimpleResult> {
  const actor = await authorizeKey(scope);
  const endpoint = actor ? await findEndpoint(scope.apiKeyId, endpointId) : null;
  if (!actor || !endpoint || typeof active !== "boolean") return { ok: false, error: "notFound" };

  await db
    .update(webhookEndpoints)
    .set({ isActive: active, updatedAt: new Date(), ...(active ? { disabledReason: null, consecutiveFailures: 0 } : {}) })
    .where(eq(webhookEndpoints.id, endpoint.id));
  await logActivity({ subject: "apiKey", subjectId: scope.apiKeyId, event: "updated", description: `${active ? "Enabled" : "Disabled"} webhook #${endpoint.id} on API key #${scope.apiKeyId}`, actorUserId: actor.userId, properties: { section: "webhook", webhookId: endpoint.id } });
  return { ok: true };
}

export async function deleteWebhookEndpoint(scope: WebhookKeyScope, endpointId: unknown): Promise<WebhookSimpleResult> {
  const actor = await authorizeKey(scope);
  const endpoint = actor ? await findEndpoint(scope.apiKeyId, endpointId) : null;
  if (!actor || !endpoint) return { ok: false, error: "notFound" };

  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpoint.id));
  await logActivity({ subject: "apiKey", subjectId: scope.apiKeyId, event: "updated", description: `Deleted webhook #${endpoint.id} on API key #${scope.apiKeyId}`, actorUserId: actor.userId, properties: { section: "webhook", webhookId: endpoint.id } });
  return { ok: true };
}

export async function revealWebhookSecret(scope: WebhookKeyScope, endpointId: unknown): Promise<WebhookSecretResult> {
  const actor = await authorizeKey(scope);
  const endpoint = actor ? await findEndpoint(scope.apiKeyId, endpointId) : null;
  if (!actor || !endpoint) return { ok: false, error: "notFound" };
  return { ok: true, secret: decrypt(endpoint.secretEncrypted) };
}

export async function rotateWebhookSecret(scope: WebhookKeyScope, endpointId: unknown): Promise<WebhookSecretResult> {
  const actor = await authorizeKey(scope);
  const endpoint = actor ? await findEndpoint(scope.apiKeyId, endpointId) : null;
  if (!actor || !endpoint) return { ok: false, error: "notFound" };

  const secret = generateSecret();
  await db.update(webhookEndpoints).set({ secretEncrypted: encrypt(secret), updatedAt: new Date() }).where(eq(webhookEndpoints.id, endpoint.id));
  await logActivity({ subject: "apiKey", subjectId: scope.apiKeyId, event: "updated", description: `Rotated the secret of webhook #${endpoint.id}`, actorUserId: actor.userId, properties: { section: "webhook", webhookId: endpoint.id } });
  return { ok: true, secret };
}

/** Sends a `ping` event right away, a failed test is not retried. */
export async function sendWebhookTest(scope: WebhookKeyScope, endpointId: unknown): Promise<WebhookSendResult> {
  const actor = await authorizeKey(scope);
  const endpoint = actor ? await findEndpoint(scope.apiKeyId, endpointId) : null;
  if (!actor || !endpoint) return { ok: false, error: "notFound" };

  const payload = { event: "ping", occurred_at: new Date().toISOString(), data: { webhook_id: endpoint.id, message: "GC Stats webhook test" } };
  const result = await sendTestPing(endpoint.id, payload);
  if (!result) return { ok: false, error: "busy" };
  return { ok: true, delivered: result.ok, statusCode: result.statusCode, error: result.error };
}

export async function redeliverWebhook(scope: WebhookKeyScope, deliveryId: unknown): Promise<WebhookSendResult> {
  const actor = await authorizeKey(scope);
  if (!actor || typeof deliveryId !== "number" || !Number.isInteger(deliveryId)) return { ok: false, error: "notFound" };
  const [owned] = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookEndpoints.apiKeyId, scope.apiKeyId)))
    .limit(1);
  if (!owned) return { ok: false, error: "notFound" };

  const result = await sendDeliveryNow(owned.id);
  if (!result) return { ok: false, error: "busy" };
  return { ok: true, delivered: result.ok, statusCode: result.statusCode, error: result.error };
}

/** Team filter picker: public teams only, any signed in user. */
export async function searchWebhookTeams(query: string): Promise<TeamPickerResult[]> {
  if (!(await getCurrentUserId())) return [];
  return searchTeamsQuery(typeof query === "string" ? query.slice(0, 100) : "");
}
