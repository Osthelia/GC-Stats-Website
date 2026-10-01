/**
 * GC-Stats - account-security
 *
 * Counts a user's independent sign in methods (password, OAuth accounts,
 * passkeys), used to prevent mutations that would leave an account with
 * zero ways to authenticate.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db } from "@gc-stats/db/client";
import { users, accounts, authenticators } from "@gc-stats/db";
import { eq } from "drizzle-orm";

/**
 * Number of independent ways a user can sign in: password + one per linked
 * OAuth account + one per registered passkey. Mirrors V1's
 * `AccountSecurityService`/`User::authMethodsCount()` — every mutation that
 * could remove an auth method (unlink a provider, remove the password,
 * delete a passkey) must refuse to drop this to 0, or the account becomes
 * permanently unreachable.
 */
export async function countAuthMethods(userId: string): Promise<number> {
  const [[user], linkedAccounts, passkeys] = await Promise.all([
    db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ credentialID: authenticators.credentialID }).from(authenticators).where(eq(authenticators.userId, userId)),
  ]);

  return (user?.passwordHash ? 1 : 0) + linkedAccounts.length + passkeys.length;
}
