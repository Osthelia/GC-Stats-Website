/**
 * GC-Stats - webhooks roster
 *
 * Queues the `roster.updated` event for the endpoints listening to it when
 * an admin validates a roster watch signal. No database trigger feeds this
 * event, the deliveries are created directly and sent by the dispatch job.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, webhookDeliveries, webhookEndpoints, type XSignalMedia } from "@gc-stats/db";
import { ROSTER_WEBHOOK_EVENT } from "./shared";

export type ValidatedRosterSignal = {
  id: number;
  teamId: number;
  teamName: string;
  tweetUrl: string;
  text: string;
  media: XSignalMedia[];
  tweetedAt: Date;
  topic: string | null;
  players: string[];
  validatedAt: Date;
};

/** Returns the number of deliveries queued. */
export async function queueRosterWebhooks(signal: ValidatedRosterSignal): Promise<number> {
  const endpoints = await db
    .select({ id: webhookEndpoints.id, filterTeamIds: webhookEndpoints.filterTeamIds })
    .from(webhookEndpoints)
    .innerJoin(apiKeys, and(eq(apiKeys.id, webhookEndpoints.apiKeyId), eq(apiKeys.isActive, true), eq(apiKeys.kind, "partner")))
    .where(and(eq(webhookEndpoints.isActive, true), sql`${ROSTER_WEBHOOK_EVENT} = any(${webhookEndpoints.events})`));

  const matching = endpoints.filter((endpoint) => endpoint.filterTeamIds.length === 0 || endpoint.filterTeamIds.includes(signal.teamId));
  if (matching.length === 0) return 0;

  const payload = {
    event: ROSTER_WEBHOOK_EVENT,
    event_id: signal.id,
    occurred_at: signal.validatedAt.toISOString(),
    data: {
      signal_id: signal.id,
      team_id: signal.teamId,
      team_name: signal.teamName,
      tweet_url: signal.tweetUrl,
      tweet_text: signal.text,
      tweeted_at: signal.tweetedAt.toISOString(),
      topic: signal.topic,
      players: signal.players,
      media: signal.media,
    },
  };
  await db.insert(webhookDeliveries).values(matching.map((endpoint) => ({ endpointId: endpoint.id, eventType: ROSTER_WEBHOOK_EVENT, entityId: signal.id, payload })));
  return matching.length;
}
