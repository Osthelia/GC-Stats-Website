/**
 * GC-Stats - webhooks module
 *
 * Outgoing webhooks of partner API keys. Database triggers fill
 * `webhook_events` (one pending row per entity and event type), the
 * dispatch job turns them into `webhook_deliveries` for every matching
 * endpoint and sends them with retries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, boolean, integer, smallint, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { apiKeys } from "./auth";

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  apiKeyId: bigint("api_key_id", { mode: "number" }).notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  description: text("description"),
  secretEncrypted: text("secret_encrypted").notNull(),
  events: text("events").array().notNull(),
  // Empty array = no filter.
  filterRegions: text("filter_regions").array().notNull().default(sql`'{}'::text[]`),
  filterTeamIds: bigint("filter_team_ids", { mode: "number" }).array().notNull().default(sql`'{}'::bigint[]`),
  filterOfficial: text("filter_official").notNull().default("all"), // 'all' | 'official' | 'unofficial'
  isActive: boolean("is_active").notNull().default(true),
  // Set when the dispatcher switched the endpoint off after too many failures in a row.
  disabledReason: text("disabled_reason"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("webhook_endpoints_api_key_id_idx").on(t.apiKeyId),
]);

// Outbox written by the triggers of the 0054 migration, coalesced while pending.
export const webhookEvents = pgTable("webhook_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  eventType: text("event_type").notNull(),
  entityId: bigint("entity_id", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("webhook_events_pending_unique").on(t.eventType, t.entityId).where(sql`${t.processedAt} is null`),
  index("webhook_events_processed_at_idx").on(t.processedAt),
]);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  endpointId: bigint("endpoint_id", { mode: "number" }).notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  entityId: bigint("entity_id", { mode: "number" }),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'success' | 'failed'
  attempts: smallint("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lastStatusCode: smallint("last_status_code"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
}, (t) => [
  index("webhook_deliveries_endpoint_id_created_at_idx").on(t.endpointId, t.createdAt),
  index("webhook_deliveries_due_idx").on(t.nextAttemptAt).where(sql`${t.status} = 'pending'`),
]);
