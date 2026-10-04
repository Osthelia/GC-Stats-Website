/**
 * GC-Stats - session
 *
 * Tiny helper to read the current authenticated user id from the session.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { auth } from "@/auth";

/**
 * `auth()` once per request: every call runs the `jwt` callback, which hits
 * the DB (revocation check) — the site layout and the page both need it.
 */
export const getSession = cache(() => auth());

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}
