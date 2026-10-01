/**
 * GC-Stats - discord-webhook
 *
 * Fire-and-forget Discord webhook post. Never throws: a failed notification
 * must not break the caller.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export async function postDiscordWebhook(url: string | undefined, content: string): Promise<void> {
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      console.warn(`[discord-webhook] request failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn("[discord-webhook] request threw", error);
  }
}
