/**
 * GC-Stats - activity-log
 *
 * Shared writer for the activity_log table: one entry per tracked edit, with
 * an optional before/after diff of the changed fields.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { adminDb } from "@gc-stats/db/client";
import { activityLog } from "@gc-stats/db";

export type ActivityLogClient = Pick<typeof adminDb, "insert">;

export type ActivitySubject = "team" | "organization" | "player" | "tournament" | "match" | "map" | "user" | "author";

/** Category shown in the log filter, defaults to the subject. */
export type ActivityLogName = ActivitySubject | "account" | "moderation";

export type ActivityEvent = "created" | "updated" | "deleted" | "login" | "login_failed" | "logout";

export type ActivityChanges = Record<string, { old: unknown; new: unknown }>;

type LogActivityInput = {
  subject: ActivitySubject;
  /** Null when the subject is unknown (login attempt on an unregistered email). */
  subjectId: number | string | null;
  event: ActivityEvent;
  logName?: ActivityLogName;
  description: string;
  actorUserId: string | null;
  changes?: ActivityChanges;
  properties?: Record<string, unknown>;
};

/** Writes one entry (pass the transaction as `client` to commit it with the edit itself). */
export async function logActivity(input: LogActivityInput, client: ActivityLogClient = adminDb): Promise<void> {
  const { subject, subjectId, event, logName, description, actorUserId, changes, properties } = input;
  await client.insert(activityLog).values({
    logName: logName ?? subject,
    description,
    subjectType: subject,
    subjectId: subjectId === null ? null : String(subjectId),
    event,
    attributeChanges: changes && Object.keys(changes).length > 0 ? changes : null,
    properties: { ...properties, actorUserId },
  });
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Before/after of only the fields whose value actually changed (empty when nothing changed). */
export function diffChanges(before: Record<string, unknown>, after: Record<string, unknown>): ActivityChanges {
  const changes: ActivityChanges = {};
  for (const key of Object.keys(after)) {
    if (!sameValue(before[key], after[key])) changes[key] = { old: before[key] ?? null, new: after[key] ?? null };
  }
  return changes;
}
