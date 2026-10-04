/**
 * GC-Stats - auth-throttle
 *
 * Throttles for auth endpoints that sit outside proxy.ts's middleware
 * matcher (credentials callback, 2FA, register, password reset).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { checkRateLimit } from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 5 * 60_000;
const LOGIN_MAX_PER_EMAIL = 10;
const LOGIN_MAX_PER_IP = 30;

/** Every credentials login attempt (password stage) counts against both keys, whichever hits first wins. */
export async function checkLoginThrottle(email: string, ip: string): Promise<boolean> {
  const emailOk = await checkRateLimit(`login:email:${email.toLowerCase()}`, LOGIN_WINDOW_MS, LOGIN_MAX_PER_EMAIL);
  const ipOk = await checkRateLimit(`login:ip:${ip}`, LOGIN_WINDOW_MS, LOGIN_MAX_PER_IP);
  return emailOk && ipOk;
}

const TWO_FACTOR_WINDOW_MS = 5 * 60_000;
const TWO_FACTOR_MAX_PER_USER = 8;

/** Independent from the password throttle — an attacker with a valid password shouldn't get unlimited TOTP guesses. */
export async function checkTwoFactorThrottle(userId: string): Promise<boolean> {
  return checkRateLimit(`2fa:${userId}`, TWO_FACTOR_WINDOW_MS, TWO_FACTOR_MAX_PER_USER);
}

const REGISTER_WINDOW_MS = 60 * 60_000;
const REGISTER_MAX_PER_IP = 10;

/** Slows down both mass account creation and username/email enumeration through actions/register.ts's per-field "taken" errors. */
export async function checkRegisterThrottle(ip: string): Promise<boolean> {
  return checkRateLimit(`register:ip:${ip}`, REGISTER_WINDOW_MS, REGISTER_MAX_PER_IP);
}

const PASSWORD_RESET_WINDOW_MS = 60 * 60_000;
const PASSWORD_RESET_MAX_PER_EMAIL = 5;
const PASSWORD_RESET_MAX_PER_IP = 20;

/** Gates actions/password-reset.ts's requestPasswordReset — its response never reveals whether the email exists, this stops it being used to mass-spam a mailbox. */
export async function checkPasswordResetThrottle(email: string, ip: string): Promise<boolean> {
  const emailOk = await checkRateLimit(`pwreset:email:${email.toLowerCase()}`, PASSWORD_RESET_WINDOW_MS, PASSWORD_RESET_MAX_PER_EMAIL);
  const ipOk = await checkRateLimit(`pwreset:ip:${ip}`, PASSWORD_RESET_WINDOW_MS, PASSWORD_RESET_MAX_PER_IP);
  return emailOk && ipOk;
}

const VERIFICATION_EMAIL_WINDOW_MS = 60 * 60_000;
const VERIFICATION_EMAIL_MAX_PER_USER = 3;

/** Gates the "send verification email" button of the account settings. */
export async function checkVerificationEmailThrottle(userId: string): Promise<boolean> {
  return checkRateLimit(`verify-email:user:${userId}`, VERIFICATION_EMAIL_WINDOW_MS, VERIFICATION_EMAIL_MAX_PER_USER);
}
