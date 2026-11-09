/**
 * GCS - oauth-profile
 *
 * Extracts the public username of a user from an OAuth provider profile.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { accounts } from "@gc-stats/db";
import { adminDb as db } from "@gc-stats/db/client";
import { and, eq } from "drizzle-orm";

const MAX_USERNAME_LENGTH = 100;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_USERNAME_LENGTH) : null;
}

/** Handle of the account on its provider (Discord, Twitch or Twitter), or null when the profile has none. */
export function getProviderUsername(provider: string, profile: unknown): string | null {
  try {
    if (!profile || typeof profile !== "object") return null;
    const p = profile as Record<string, unknown>;
    switch (provider) {
      case "discord":
        return asString(p.username);
      case "twitch":
        return asString(p.preferred_username) ?? asString(p.login);
      case "twitter": {
        // Twitter API v2 wraps the user in `data`.
        const data = p.data && typeof p.data === "object" ? (p.data as Record<string, unknown>) : p;
        return asString(data.username);
      }
      default:
        return null;
    }
  } catch (error) {
    // The username is cosmetic, so an unexpected profile shape must never break a login.
    console.error("[oauth-profile] username extraction failed (%s)", provider, error);
    return null;
  }
}

/** Stores the latest provider username, since users can rename themselves on the provider. */
export async function syncProviderUsername(provider: string, providerAccountId: string, profile: unknown): Promise<void> {
  const providerUsername = getProviderUsername(provider, profile);
  if (!providerUsername) return;
  await db
    .update(accounts)
    .set({ providerUsername })
    .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)));
}
