/**
 * GC-Stats - email-verification
 *
 * Verification email sending, and trust of the email verification done by
 * OAuth providers (Discord, Twitch) at sign in.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, isNull } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { adminDb as db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { createVerificationToken } from "@/lib/verification-tokens";
import { sendEmail } from "@/lib/email/client";
import { renderNotificationEmail } from "@/lib/email/notification-template";
import { APP_BASE_URL } from "@/lib/notify";

export async function sendVerificationEmail(email: string): Promise<void> {
  const locale = await getLocale();
  const token = await createVerificationToken(`verify-email:${email}`);
  const t = await getTranslations({ locale, namespace: "auth.verifyEmail.email" });
  const link = `${APP_BASE_URL}/${locale}/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
  const { html, text } = renderNotificationEmail(t("subject"), t("body"), link, t("cta"));
  await sendEmail({ to: email, subject: t("subject"), html, text });
}

/**
 * The email the provider explicitly states as verified, from its raw
 * profile. Anything not explicitly confirmed (or a provider sharing no
 * email, like X) returns null.
 */
export function providerVerifiedEmail(provider: string, profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const p = profile as Record<string, unknown>;
  let email: unknown = null;

  if (provider === "discord" && p.verified === true) email = p.email;
  // id_token claims, email_verified is requested in auth.ts.
  else if (provider === "twitch" && p.email_verified === true) email = p.email;

  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

/** Marks the account email verified when it matches the provider's verified email. */
export async function markEmailVerifiedFromProvider(userId: string, provider: string, profile: unknown): Promise<void> {
  const email = providerVerifiedEmail(provider, profile);
  if (!email) return;
  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(and(eq(users.id, userId), eq(users.email, email), isNull(users.emailVerified)));
}
