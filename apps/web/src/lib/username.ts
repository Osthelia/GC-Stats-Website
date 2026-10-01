/**
 * GC-Stats - username
 *
 * Generates a unique username by slugifying a base string (e.g. an OAuth
 * display name) and appending a random suffix on collision. Used for
 * sign in flows that don't collect a username directly.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { eq } from "drizzle-orm";

// Mirrors V1's App\Support\UsernameGenerator — derives a unique
// `users.username` for flows that don't collect one directly (OAuth/passkey
// first sign-in, cf. the `createUser` event in auth.ts).
export async function generateUsername(base: string | null | undefined): Promise<string> {
  const slugged = (base ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (e.g. é -> e) after NFKD decomposition
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  const slug = slugged || "user";

  let username = slug;
  while (await usernameTaken(username)) {
    username = `${slug}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return username;
}

async function usernameTaken(username: string): Promise<boolean> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  return Boolean(existing);
}
