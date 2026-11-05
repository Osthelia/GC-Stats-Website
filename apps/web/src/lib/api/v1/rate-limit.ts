/**
 * GC-Stats - rate-limit
 *
 * Per API key rate limit of the API, on top of lib/rate-limit.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import { checkRateLimit as checkKeyedRateLimit } from "@/lib/rate-limit";
import { PUBLIC_API_WINDOW_MS } from "@/lib/public-api/config-shared";
import type { ResolvedApiKey } from "./auth";
const WINDOW_MS = 60_000;
/**
 * Partner keys: their own per minute limit, `null` = unlimited. Public keys: the per second
 * limit of /admin/settings, shared by every public key of the same account. `cost` lets a heavier endpoint
 * (teams/players = 10) consume more of the window per call. Returns true when the call is allowed.
 */
export async function checkRateLimit(key: Pick<ResolvedApiKey, "id" | "kind" | "rateLimit" | "userId">, publicRatePerSecond: number, cost = 1): Promise<boolean> {
  if (key.kind === "public") return checkKeyedRateLimit(`apikey:public:user:${key.userId ?? `key${key.id}`}`, PUBLIC_API_WINDOW_MS, publicRatePerSecond, cost);
  if (key.rateLimit == null) return true;
  return checkKeyedRateLimit(`apikey:${key.id}`, WINDOW_MS, key.rateLimit, cost);
}
