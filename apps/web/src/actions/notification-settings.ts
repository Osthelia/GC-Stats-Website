/**
 * GC-Stats - notification-settings
 *
 * Server actions for a user's notification preferences: email categories
 * and Discord notifications, gated on Discord account link/guild status.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { auth } from "@/auth";
import { EMAIL_CATEGORIES, type EmailCategory } from "@/lib/notification-categories";
import { getLinkedDiscordId, hasJoinedDiscordGuild } from "@/lib/discord-guild-membership";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function updateEmailNotificationPreferences(prefs: Record<EmailCategory, boolean>): Promise<ActionResult> {
  const userId = await requireUserId();

  for (const category of EMAIL_CATEGORIES) {
    if (typeof prefs[category] !== "boolean") return { ok: false, error: "invalid" };
  }

  const [user] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1);
  const current = (user?.preferences as Record<string, unknown> | null) ?? {};
  const merged = { ...current, emailNotifications: prefs };

  await db.update(users).set({ preferences: merged }).where(eq(users.id, userId));
  return { ok: true };
}

export async function refreshDiscordEligibility(): Promise<{ linked: boolean; joined: boolean }> {
  const userId = await requireUserId();
  const discordId = await getLinkedDiscordId(userId);
  if (!discordId) return { linked: false, joined: false };
  return { linked: true, joined: await hasJoinedDiscordGuild(userId) };
}

export async function updateDiscordNotificationPreferences(prefs: Record<EmailCategory, boolean>): Promise<ActionResult> {
  const userId = await requireUserId();

  for (const category of EMAIL_CATEGORIES) {
    if (typeof prefs[category] !== "boolean") return { ok: false, error: "invalid" };
  }

  // Re-checked server side: a client can't force categories on without the
  // account actually being eligible (linked + joined the Discord server).
  if (Object.values(prefs).some(Boolean)) {
    const discordId = await getLinkedDiscordId(userId);
    if (!discordId) return { ok: false, error: "notLinked" };
    if (!(await hasJoinedDiscordGuild(userId))) return { ok: false, error: "notJoined" };
  }

  const [user] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1);
  const current = (user?.preferences as Record<string, unknown> | null) ?? {};
  const merged = { ...current, discordNotifications: prefs };

  await db.update(users).set({ preferences: merged }).where(eq(users.id, userId));
  return { ok: true };
}
