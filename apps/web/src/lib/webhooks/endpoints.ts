/**
 * GC-Stats - webhooks endpoints
 *
 * Webhook endpoints and recent deliveries of a partner API key, for the
 * dashboard key page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { teams, webhookDeliveries, webhookEndpoints } from "@gc-stats/db";
import { isWebhookEvent, type WebhookDeliveryStatus, type WebhookDeliveryView, type WebhookEndpointView, type WebhookOfficialFilter } from "./shared";

const RECENT_DELIVERIES = 30;

export async function listWebhookEndpoints(apiKeyId: number): Promise<WebhookEndpointView[]> {
  const rows = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.apiKeyId, apiKeyId)).orderBy(asc(webhookEndpoints.createdAt));
  const teamIds = [...new Set(rows.flatMap((r) => r.filterTeamIds))];
  const teamRows = teamIds.length ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds)) : [];
  const teamName = new Map(teamRows.map((t) => [t.id, t.name]));

  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    description: r.description,
    events: r.events.filter(isWebhookEvent),
    filterRegions: r.filterRegions,
    filterTeams: r.filterTeamIds.map((id) => ({ id, name: teamName.get(id) ?? `#${id}` })),
    filterOfficial: r.filterOfficial as WebhookOfficialFilter,
    isActive: r.isActive,
    disabledReason: r.disabledReason,
    lastSuccessAt: r.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: r.lastFailureAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listRecentWebhookDeliveries(apiKeyId: number): Promise<WebhookDeliveryView[]> {
  const rows = await db
    .select({
      id: webhookDeliveries.id,
      endpointId: webhookDeliveries.endpointId,
      eventType: webhookDeliveries.eventType,
      entityId: webhookDeliveries.entityId,
      status: webhookDeliveries.status,
      attempts: webhookDeliveries.attempts,
      lastStatusCode: webhookDeliveries.lastStatusCode,
      lastError: webhookDeliveries.lastError,
      createdAt: webhookDeliveries.createdAt,
      deliveredAt: webhookDeliveries.deliveredAt,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(eq(webhookEndpoints.apiKeyId, apiKeyId))
    .orderBy(desc(webhookDeliveries.id))
    .limit(RECENT_DELIVERIES);
  return rows.map((r) => ({ ...r, status: r.status as WebhookDeliveryStatus, createdAt: r.createdAt.toISOString(), deliveredAt: r.deliveredAt?.toISOString() ?? null }));
}

/** Regions of the public tournaments, the choices of the region filter. */
export async function listWebhookRegions(): Promise<string[]> {
  const result = await db.execute<{ region: string }>(sql`select distinct region from tournaments where active and not is_ghost and region is not null and region <> '' order by region`);
  return result.rows.map((r) => r.region);
}
