/**
 * GC-Stats - client
 *
 * Sends transactional emails through Resend's HTTP API. Fails open on any
 * problem so an email outage never blocks the action that triggered it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const SEND_TIMEOUT_MS = 5000;

export type SendEmailInput = { to: string; subject: string; html: string; text: string };

/**
 * Sends a transactional email through Resend's HTTP API. Fails open on any
 * problem (missing key, timeout, non-2xx, network error) — an outage must
 * never block the action that triggered it, mirrors checkTextModeration in
 * lib/openai-moderation.ts. In-app notifications never depend on this.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is not set, skipping email send");
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL || "notifications@gc-stats.gg";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[email] Resend request failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn("[email] Resend request threw", error);
  } finally {
    clearTimeout(timeout);
  }
}
