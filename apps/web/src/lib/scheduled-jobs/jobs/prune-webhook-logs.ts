/**
 * GC-Stats - prune-webhook-logs
 *
 * Scheduled job: deletes processed webhook events and finished deliveries
 * older than their retention window.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, lt, ne } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { webhookDeliveries, webhookEvents } from "@gc-stats/db";

const EVENTS_RETENTION_DAYS = 7;
const DELIVERIES_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function pruneWebhookLogs(): Promise<string> {
  const now = Date.now();
  const events = await db.delete(webhookEvents).where(lt(webhookEvents.processedAt, new Date(now - EVENTS_RETENTION_DAYS * DAY_MS)));
  const deliveries = await db
    .delete(webhookDeliveries)
    .where(and(ne(webhookDeliveries.status, "pending"), lt(webhookDeliveries.createdAt, new Date(now - DELIVERIES_RETENTION_DAYS * DAY_MS))));
  return `pruned ${events.rowCount ?? 0} webhook event(s) and ${deliveries.rowCount ?? 0} delivery(ies)`;
}
