/**
 * GC-Stats - session-reissue
 *
 * One-time token letting the tab that just changed a credential keep its
 * session after every session was invalidated. Only the server action's
 * caller ever sees it, so a stolen cookie can't use it to survive revocation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { createVerificationToken, consumeVerificationToken } from "@/lib/verification-tokens";

const REISSUE_TTL_MS = 5 * 60_000;

export function createSessionReissueToken(userId: string): Promise<string> {
  return createVerificationToken(`session-reissue:${userId}`, REISSUE_TTL_MS);
}

export function consumeSessionReissueToken(userId: string, token: string): Promise<boolean> {
  return consumeVerificationToken(`session-reissue:${userId}`, token);
}
