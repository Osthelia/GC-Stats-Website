/**
 * GC-Stats - webhooks dispatch
 *
 * Turns the pending `webhook_events` (filled by database triggers) into one
 * `webhook_deliveries` row per matching endpoint, then sends the due
 * deliveries. A delivery is leased before it is sent, so several replicas
 * can run the job at once without sending twice. Failed attempts are
 * retried with a growing delay, an endpoint failing too often in a row is
 * switched off.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";
import https from "node:https";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { apiKeys, tournaments, webhookDeliveries, webhookEndpoints } from "@gc-stats/db";
import { decrypt } from "@/lib/encryption";
import { queryOpenDataRowsByIds } from "@/lib/opendata/datasets";
import type { OpenDataDataset, OpenDataRow } from "@/lib/opendata/datasets-meta";
import { guardedLookup } from "./url-guard";
import { WEBHOOK_REGION_SCOPED_EVENTS, isWebhookEvent, type WebhookEvent, type WebhookOfficialFilter } from "./shared";

const EVENT_BATCH = 500;
const DELIVERY_BATCH = 200;
const SEND_CONCURRENCY = 10;
/** Total deadline of one request. */
const REQUEST_TIMEOUT_MS = 10_000;
/** Well above a full batch sent at the deadline (DELIVERY_BATCH / SEND_CONCURRENCY rounds of REQUEST_TIMEOUT_MS). */
const LEASE = "10 minutes";
const MAX_RESPONSE_BYTES = 64 * 1024;
/** Delay before attempt n + 1, the delivery fails for good after the last one. */
const RETRY_DELAYS_S = [60, 300, 1800, 7200, 21600];
const DISABLE_AFTER_FAILURES = 20;

const DATASET_BY_ENTITY: Record<string, OpenDataDataset> = { match: "matches", tournament: "tournaments", team: "teams", player: "players" };

type EventContext = { region: string | null; official: boolean | null; teamIds: number[] };

type ActiveEndpoint = {
  id: number;
  events: string[];
  filterRegions: string[];
  filterTeamIds: number[];
  filterOfficial: string;
};

function intOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function matchesEndpoint(endpoint: ActiveEndpoint, event: WebhookEvent, context: EventContext): boolean {
  if (!endpoint.events.includes(event)) return false;
  if (WEBHOOK_REGION_SCOPED_EVENTS.includes(event)) {
    if (endpoint.filterRegions.length > 0 && (!context.region || !endpoint.filterRegions.includes(context.region))) return false;
    const official = endpoint.filterOfficial as WebhookOfficialFilter;
    if (official === "official" && context.official !== true) return false;
    if (official === "unofficial" && context.official !== false) return false;
  }
  if (endpoint.filterTeamIds.length > 0 && !context.teamIds.some((id) => endpoint.filterTeamIds.includes(id))) return false;
  return true;
}

async function loadTournamentOfficial(ids: number[]): Promise<Map<number, boolean>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: tournaments.id, isOfficial: tournaments.isOfficial }).from(tournaments).where(inArray(tournaments.id, ids));
  return new Map(rows.map((r) => [r.id, r.isOfficial]));
}

/** Entity rows and filter context of a batch of events of one entity type. */
async function loadEntities(entity: string, ids: number[]): Promise<Map<number, { row: OpenDataRow; context: EventContext }>> {
  const dataset = DATASET_BY_ENTITY[entity];
  if (!dataset) return new Map();
  const rows = await queryOpenDataRowsByIds(dataset, ids);
  const result = new Map<number, { row: OpenDataRow; context: EventContext }>();

  if (entity === "match") {
    const tournamentIds = [...new Set([...rows.values()].map((r) => intOrNull(r.tournament_id)).filter((id): id is number => id !== null))];
    const [tournamentRows, officialById] = await Promise.all([queryOpenDataRowsByIds("tournaments", tournamentIds), loadTournamentOfficial(tournamentIds)]);
    for (const [id, row] of rows) {
      const tournamentId = intOrNull(row.tournament_id);
      const region = (tournamentId !== null ? (tournamentRows.get(tournamentId)?.region as string | null) : null) ?? null;
      const official = tournamentId !== null ? (officialById.get(tournamentId) ?? null) : null;
      const teamIds = [intOrNull(row.team_a_id), intOrNull(row.team_b_id)].filter((t): t is number => t !== null);
      result.set(id, { row, context: { region, official, teamIds } });
    }
  } else if (entity === "tournament") {
    const officialById = await loadTournamentOfficial([...rows.keys()]);
    const entrants = rows.size
      ? await db.execute<{ tournament_id: number; team_ids: number[] }>(
          sql`select tournament_id::int, array_agg(distinct team_id)::int[] as team_ids from entrants where team_id is not null and tournament_id = any(${sql.raw(`array[${[...rows.keys()].join(",")}]::bigint[]`)}) group by tournament_id`,
        )
      : { rows: [] };
    const teamsByTournament = new Map(entrants.rows.map((r) => [r.tournament_id, r.team_ids]));
    for (const [id, row] of rows) {
      const region = (row.region as string | null) ?? null;
      result.set(id, { row, context: { region, official: officialById.get(id) ?? null, teamIds: teamsByTournament.get(id) ?? [] } });
    }
  } else {
    for (const [id, row] of rows) {
      const teamId = entity === "team" ? id : intOrNull(row.current_team_id);
      result.set(id, { row, context: { region: null, official: null, teamIds: teamId !== null ? [teamId] : [] } });
    }
  }
  return result;
}

/** Claims pending events and queues a delivery for every endpoint they match. Returns [events, deliveries]. */
async function fanOutEvents(): Promise<[number, number]> {
  // The claim only commits with the deliveries, a failure leaves the events pending.
  return db.transaction(async (tx) => {
    const claimed = await tx.execute<{ id: number; event_type: string; entity_id: number; created_at: string }>(sql`
      update webhook_events set processed_at = now()
      where id in (select id from webhook_events where processed_at is null order by id limit ${EVENT_BATCH} for update skip locked)
      returning id::int, event_type, entity_id::int, created_at`);
    if (claimed.rows.length === 0) return [0, 0];

    const endpoints: ActiveEndpoint[] = await tx
      .select({ id: webhookEndpoints.id, events: webhookEndpoints.events, filterRegions: webhookEndpoints.filterRegions, filterTeamIds: webhookEndpoints.filterTeamIds, filterOfficial: webhookEndpoints.filterOfficial })
      .from(webhookEndpoints)
      .innerJoin(apiKeys, and(eq(apiKeys.id, webhookEndpoints.apiKeyId), eq(apiKeys.isActive, true), eq(apiKeys.kind, "partner")))
      .where(eq(webhookEndpoints.isActive, true));
    if (endpoints.length === 0) return [claimed.rows.length, 0];

    const byEntity = new Map<string, number[]>();
    for (const e of claimed.rows) {
      const entity = e.event_type.split(".")[0] ?? "";
      if (!DATASET_BY_ENTITY[entity]) continue;
      byEntity.set(entity, [...(byEntity.get(entity) ?? []), e.entity_id]);
    }
    const loaded = new Map<string, Map<number, { row: OpenDataRow; context: EventContext }>>();
    for (const [entity, ids] of byEntity) loaded.set(entity, await loadEntities(entity, [...new Set(ids)]));

    const values: (typeof webhookDeliveries.$inferInsert)[] = [];
    for (const e of claimed.rows) {
      if (!isWebhookEvent(e.event_type)) continue;
      const entity = loaded.get(e.event_type.split(".")[0] ?? "")?.get(e.entity_id);
      // Hidden, ghost or deleted since the change: nothing public to send.
      if (!entity) continue;
      const payload = {
        event: e.event_type,
        event_id: e.id,
        occurred_at: new Date(e.created_at).toISOString(),
        ...(WEBHOOK_REGION_SCOPED_EVENTS.includes(e.event_type) ? { region: entity.context.region, official: entity.context.official } : {}),
        data: entity.row,
      };
      for (const endpoint of endpoints) {
        if (matchesEndpoint(endpoint, e.event_type, entity.context)) values.push({ endpointId: endpoint.id, eventType: e.event_type, entityId: e.entity_id, payload });
      }
    }
    for (let i = 0; i < values.length; i += 500) await tx.insert(webhookDeliveries).values(values.slice(i, i + 500));
    return [claimed.rows.length, values.length] as [number, number];
  });
}

export function signWebhookBody(secret: string, timestamp: number, body: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type SendResult = { ok: boolean; statusCode: number | null; error: string | null };

/** One HTTPS POST, no redirect followed, private addresses refused at connection time. */
export function postWebhook(url: string, secret: string, deliveryId: number, eventType: string, payload: unknown): Promise<SendResult> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  return new Promise((resolve) => {
    let settled = false;
    let deadline: NodeJS.Timeout | undefined;
    const done = (result: SendResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };
    try {
      const request = https.request(
        url,
        {
          method: "POST",
          lookup: guardedLookup,
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            "User-Agent": "GCStats-Webhook/1.0",
            "X-GCS-Event": eventType,
            "X-GCS-Delivery": String(deliveryId),
            "X-GCS-Timestamp": String(timestamp),
            "X-GCS-Signature": `sha256=${signWebhookBody(secret, timestamp, body)}`,
          },
        },
        (response) => {
          let received = 0;
          response.on("data", (chunk: Buffer) => {
            received += chunk.length;
            if (received > MAX_RESPONSE_BYTES) response.destroy();
          });
          response.on("close", () => {
            const statusCode = response.statusCode ?? null;
            const ok = statusCode !== null && statusCode >= 200 && statusCode < 300;
            done({ ok, statusCode, error: ok ? null : `HTTP ${statusCode}` });
          });
        },
      );
      request.on("timeout", () => request.destroy(new Error("timeout")));
      deadline = setTimeout(() => request.destroy(new Error("timeout")), REQUEST_TIMEOUT_MS);
      request.on("error", (error: NodeJS.ErrnoException) => done({ ok: false, statusCode: null, error: (error.code ?? error.message).slice(0, 200) }));
      request.end(body);
    } catch (error) {
      done({ ok: false, statusCode: null, error: error instanceof Error ? error.message.slice(0, 200) : "request failed" });
    }
  });
}

type DueDelivery = { id: number; endpointId: number; eventType: string; payload: unknown; attempts: number; url: string; secretEncrypted: string; usable: boolean };

/**
 * `scheduled`: failures are retried, then count toward disabling the endpoint.
 * `manual`: a failure leaves the status and retry schedule as they were.
 * `test`: a failure is final. Manual and test failures never count against the endpoint.
 */
type AttemptMode = "scheduled" | "manual" | "test";

/** Sends one leased delivery and records the outcome on the delivery and its endpoint. */
async function attempt(delivery: DueDelivery, mode: AttemptMode = "scheduled"): Promise<SendResult> {
  const result: SendResult = delivery.usable
    ? await postWebhook(delivery.url, decrypt(delivery.secretEncrypted), delivery.id, delivery.eventType, delivery.payload)
    : { ok: false, statusCode: null, error: "endpoint disabled" };
  const attempts = delivery.attempts + 1;

  if (result.ok) {
    await db.update(webhookDeliveries).set({ status: "success", attempts, lastStatusCode: result.statusCode, lastError: null, deliveredAt: new Date() }).where(eq(webhookDeliveries.id, delivery.id));
    await db.update(webhookEndpoints).set({ consecutiveFailures: 0, lastSuccessAt: new Date() }).where(eq(webhookEndpoints.id, delivery.endpointId));
    return result;
  }

  if (mode === "manual") {
    // Status read in SQL: a concurrent scheduled send may have finished meanwhile.
    await db
      .update(webhookDeliveries)
      .set({
        attempts,
        lastStatusCode: result.statusCode,
        lastError: result.error,
        nextAttemptAt: sql`case when ${webhookDeliveries.status} = 'pending' then now() + make_interval(secs => ${RETRY_DELAYS_S[0]}) else ${webhookDeliveries.nextAttemptAt} end`,
      })
      .where(eq(webhookDeliveries.id, delivery.id));
    return result;
  }

  const finalAttempt = mode === "test" || !delivery.usable || attempts > RETRY_DELAYS_S.length;
  await db
    .update(webhookDeliveries)
    .set({
      status: finalAttempt ? "failed" : "pending",
      attempts,
      lastStatusCode: result.statusCode,
      lastError: result.error,
      nextAttemptAt: finalAttempt ? sql`now()` : sql`now() + make_interval(secs => ${RETRY_DELAYS_S[attempts - 1]})`,
    })
    .where(eq(webhookDeliveries.id, delivery.id));
  if (mode === "scheduled" && delivery.usable) {
    await db
      .update(webhookEndpoints)
      .set({
        consecutiveFailures: sql`${webhookEndpoints.consecutiveFailures} + 1`,
        lastFailureAt: new Date(),
        isActive: sql`${webhookEndpoints.consecutiveFailures} + 1 < ${DISABLE_AFTER_FAILURES}`,
        disabledReason: sql`case when ${webhookEndpoints.consecutiveFailures} + 1 >= ${DISABLE_AFTER_FAILURES} then 'failing' else ${webhookEndpoints.disabledReason} end`,
      })
      .where(eq(webhookEndpoints.id, delivery.endpointId));
  }
  return result;
}

async function leaseDeliveries(where: ReturnType<typeof sql>, limit: number): Promise<DueDelivery[]> {
  const leased = await db.execute<{ id: number }>(sql`
    update webhook_deliveries set next_attempt_at = now() + ${sql.raw(`interval '${LEASE}'`)}
    where id in (select id from webhook_deliveries where ${where} order by next_attempt_at limit ${limit} for update skip locked)
    returning id::int`);
  if (leased.rows.length === 0) return [];
  const rows = await db
    .select({
      id: webhookDeliveries.id,
      endpointId: webhookDeliveries.endpointId,
      eventType: webhookDeliveries.eventType,
      payload: webhookDeliveries.payload,
      attempts: webhookDeliveries.attempts,
      url: webhookEndpoints.url,
      secretEncrypted: webhookEndpoints.secretEncrypted,
      endpointActive: webhookEndpoints.isActive,
      keyActive: apiKeys.isActive,
      keyKind: apiKeys.kind,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .innerJoin(apiKeys, eq(apiKeys.id, webhookEndpoints.apiKeyId))
    .where(inArray(webhookDeliveries.id, leased.rows.map((r) => r.id)));
  return rows.map(({ endpointActive, keyActive, keyKind, ...r }) => ({ ...r, usable: endpointActive && keyActive && keyKind === "partner" }));
}

async function sendDue(): Promise<{ sent: number; failed: number }> {
  const due = await leaseDeliveries(sql`status = 'pending' and next_attempt_at <= now()`, DELIVERY_BATCH);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < due.length; i += SEND_CONCURRENCY) {
    const results = await Promise.all(due.slice(i, i + SEND_CONCURRENCY).map((d) => attempt(d).catch(() => ({ ok: false }) as SendResult)));
    for (const r of results) r.ok ? sent++ : failed++;
  }
  return { sent, failed };
}

/** Manual redelivery, whatever its schedule. Null when another run holds the lease. */
export async function sendDeliveryNow(deliveryId: number): Promise<SendResult | null> {
  const [delivery] = await leaseDeliveries(sql`id = ${deliveryId}`, 1);
  if (!delivery) return null;
  return attempt(delivery, "manual");
}

/** Queues a `ping` delivery already leased, so the scheduled job never picks it up, and sends it once. */
export async function sendTestPing(endpointId: number, payload: unknown): Promise<SendResult | null> {
  const [row] = await db
    .insert(webhookDeliveries)
    .values({ endpointId, eventType: "ping", payload, nextAttemptAt: sql`now() + ${sql.raw(`interval '${LEASE}'`)}` })
    .returning({ id: webhookDeliveries.id });
  if (!row) throw new Error("webhook delivery insert returned no row");
  const [delivery] = await leaseDeliveries(sql`id = ${row.id}`, 1);
  if (!delivery) return null;
  return attempt(delivery, "test");
}

/** Scheduled job entry point. */
export async function dispatchWebhooks(): Promise<string> {
  const [events, queued] = await fanOutEvents();
  const { sent, failed } = await sendDue();
  if (events === 0 && sent === 0 && failed === 0) return "no webhook to send";
  return `processed ${events} event(s), queued ${queued}, sent ${sent}, failed ${failed}`;
}
