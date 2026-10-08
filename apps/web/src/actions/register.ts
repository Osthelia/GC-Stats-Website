/**
 * GC-Stats - register
 *
 * Server action for account registration with email/password, including
 * throttling and the verification email send.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { eq, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { getClientIp } from "@/lib/client-ip";
import { checkRegisterThrottle } from "@/lib/auth-throttle";
import { sendVerificationEmail } from "@/lib/email-verification";
import { logAccountActivity } from "@/lib/account-activity-log";

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterField = "name" | "username" | "email" | "password" | "passwordConfirmation";
export type RegisterFieldErrors = Partial<Record<RegisterField, string>>;
export type RegisterResult = { ok: true } | { ok: false; fieldErrors: RegisterFieldErrors; formError?: "tooManyAttempts" };

export type RegisterInput = {
  name: string;
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

/**
 * Creates an email/password ("credentials") account. Auth.js's Credentials
 * provider deliberately doesn't auto-create users on sign-in (see auth.ts) —
 * this is the one place account creation for that provider happens. Mirrors
 * V1's Actions/Fortify/CreateNewUser validation (name/username/email/password
 * rules), one error key per invalid field rather than a single blanket error.
 */
export async function registerWithPassword(input: RegisterInput): Promise<RegisterResult> {
  const ip = getClientIp(await headers());
  if (!(await checkRegisterThrottle(ip))) return { ok: false, fieldErrors: {}, formError: "tooManyAttempts" };

  const fieldErrors: RegisterFieldErrors = {};

  const name = input.name.trim();
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  if (!username) fieldErrors.username = "required";
  else if (!USERNAME_RE.test(username)) fieldErrors.username = "invalid";

  if (!email) fieldErrors.email = "required";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "invalid";

  if (!input.password) fieldErrors.password = "required";
  else if (input.password.length < 8) fieldErrors.password = "tooShort";

  if (input.passwordConfirmation !== input.password) fieldErrors.passwordConfirmation = "mismatch";

  // Uniqueness checks only run once the field is otherwise well-formed —
  // no point telling someone "username taken" for a username that's also invalid.
  if (!fieldErrors.username || !fieldErrors.email) {
    const existing = await db
      .select({ username: users.username, email: users.email })
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)));

    if (!fieldErrors.username && existing.some((u) => u.username === username)) {
      fieldErrors.username = "taken";
    }
    if (!fieldErrors.email && existing.some((u) => u.email === email)) {
      fieldErrors.email = "taken";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const [created] = await db.insert(users).values({ name, username, email, passwordHash }).returning({ id: users.id });
  if (created) await logAccountActivity({ userId: created.id, event: "created", description: `Account created with email and password (${username})`, ip, properties: { section: "account", method: "credentials", username } });

  await sendVerificationEmail(email);

  return { ok: true };
}
