/**
 * GC-Stats - use-riot-error-text
 *
 * The text of a relay problem or a Riot ID error, from one set of texts (`admin.riotAccounts.error`) for everything
 * that talks to the Riot relay: the game import, Find games and the player's Riot accounts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import type { RiotErrorKind } from "@/lib/riot-errors";

/** `riotId` is the typed Riot ID, for riotIdInvalid and riotIdNotFound. `retryAfterSeconds` is how long Riot asked to wait, for rateLimited. */
export function useRiotErrorText(): (kind: RiotErrorKind, riotId?: string, retryAfterSeconds?: number) => string {
  const t = useTranslations("admin.riotAccounts.error");
  return (kind, riotId = "", retryAfterSeconds) => (kind === "rateLimited" && retryAfterSeconds ? t("rateLimitedIn", { seconds: retryAfterSeconds }) : t(kind, { riotId }));
}
