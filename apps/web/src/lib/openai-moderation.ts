/**
 * GC-Stats - openai-moderation
 *
 * Calls OpenAI's free moderation endpoint for forum content. Fails open on
 * any problem (missing key, timeout, non-2xx, network error) so an outage
 * never blocks or hides a forum post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const MODERATION_TIMEOUT_MS = 5000;

export type ModerationResult = { flagged: boolean; categories: string[] };

/**
 * Calls OpenAI's free moderation endpoint. Fails open on any problem
 * (missing key, timeout, non-2xx, network error) — an outage must never
 * block or hide a forum post, mirrors V1's OpenAiModerationService.
 */
export async function checkTextModeration(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[forum-automod] OPENAI_API_KEY is not set, skipping moderation check");
    return { flagged: false, categories: [] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[forum-automod] OpenAI moderation request failed with status ${response.status}`);
      return { flagged: false, categories: [] };
    }

    const payload = (await response.json()) as { results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }> };
    const result = payload.results?.[0];
    const categories = Object.entries(result?.categories ?? {})
      .filter(([, value]) => value)
      .map(([key]) => key);

    return { flagged: !!result?.flagged, categories };
  } catch (error) {
    console.warn("[forum-automod] OpenAI moderation request threw", error);
    return { flagged: false, categories: [] };
  } finally {
    clearTimeout(timeout);
  }
}
