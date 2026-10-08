/**
 * GC-Stats - account-activity-log
 *
 * Activity log entries for account actions (login, registration, credential
 * and security changes). Each entry carries the IP of the current request.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { headers } from "next/headers";
import { getClientIp } from "@/lib/client-ip";
import { logActivity, type ActivityChanges, type ActivityEvent, type ActivityLogClient } from "@/lib/activity-log";

type AccountActivityInput = {
  /** Account concerned, null for an attempt on an unknown email. */
  userId: string | null;
  event: ActivityEvent;
  description: string;
  /** Who did it: the account itself by default, an admin for support actions, null for a failed login. */
  actorUserId?: string | null;
  /** Overrides the IP read from the current request (auth.ts reads it from its own request). */
  ip?: string;
  changes?: ActivityChanges;
  properties?: Record<string, unknown>;
};

async function currentIp(): Promise<string | null> {
  try {
    return getClientIp(await headers());
  } catch {
    return null;
  }
}

export async function logAccountActivity(input: AccountActivityInput, client?: ActivityLogClient): Promise<void> {
  const { userId, event, description, actorUserId = userId, ip, changes, properties } = input;
  await logActivity(
    { subject: "user", subjectId: userId, logName: "account", event, description, actorUserId, changes, properties: { ...properties, ip: ip ?? (await currentIp()) } },
    client
  );
}
