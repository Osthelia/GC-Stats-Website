/**
 * GC-Stats - webhooks shared
 *
 * Client safe webhook constants: event list, filters and limits, shared by
 * the dispatcher, the server actions and the dashboard panel.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const WEBHOOK_EVENTS = ["match.created", "match.updated", "tournament.created", "tournament.updated", "team.updated", "player.updated"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEvent(value: unknown): value is WebhookEvent {
  return typeof value === "string" && (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

/** Region and official filters only apply to these events, team and player events always pass them. */
export const WEBHOOK_REGION_SCOPED_EVENTS: readonly WebhookEvent[] = ["match.created", "match.updated", "tournament.created", "tournament.updated"];

export const WEBHOOK_OFFICIAL_FILTERS = ["all", "official", "unofficial"] as const;
export type WebhookOfficialFilter = (typeof WEBHOOK_OFFICIAL_FILTERS)[number];

export const WEBHOOK_LIMITS = {
  endpointsPerKey: 10,
  urlMaxLength: 500,
  descriptionMaxLength: 200,
  filterRegions: 20,
  filterTeams: 50,
} as const;

export const WEBHOOK_DELIVERY_STATUSES = ["pending", "success", "failed"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export type WebhookEndpointView = {
  id: number;
  url: string;
  description: string | null;
  events: WebhookEvent[];
  filterRegions: string[];
  filterTeams: { id: number; name: string }[];
  filterOfficial: WebhookOfficialFilter;
  isActive: boolean;
  disabledReason: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
};

export type WebhookDeliveryView = {
  id: number;
  endpointId: number;
  eventType: string;
  entityId: number | null;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

/** Partner key a webhook belongs to: a personal key, or an organization key. */
export type WebhookKeyScope = { apiKeyId: number; organizationId: number | null };
