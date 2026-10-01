/**
 * GC-Stats - discord-notifications-client
 *
 * Client for Osthelia-DiscordNotificationsWorker (separate repo, shared
 * across services). On Cloudflare it's reached through the DISCORD_NOTIFICATIONS
 * Service Binding (wrangler.jsonc), a direct Worker-to-Worker call on
 * Cloudflare's internal network, the Worker has no public URL
 * (`workers_dev = false`). DISCORD_NOTIFICATIONS_WORKER_URL only applies to the
 * self-hosted Docker deploy, where the Worker would have to be reached directly.
 * The `type`/`embed`/`container` shapes mirror the Worker's own types, kept in
 * sync by hand since there is no shared package between the two repos.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

const SERVICE_NAME = "gc-stats";
const BINDING_BASE_URL = "http://discord-notifications";

function resolveFetch(): typeof fetch {
  if (process.env.DEPLOY_TARGET !== "cloudflare") return fetch;
  const { env } = getCloudflareContext();
  return env.DISCORD_NOTIFICATIONS.fetch.bind(env.DISCORD_NOTIFICATIONS) as typeof fetch;
}

function baseUrl(): string | null {
  if (process.env.DEPLOY_TARGET === "cloudflare") return BINDING_BASE_URL;
  const url = process.env.DISCORD_NOTIFICATIONS_WORKER_URL;
  return url ? url.replace(/\/$/, "") : null;
}

export interface DiscordButton {
  label: string;
  url: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  authorName?: string;
  authorUrl?: string;
  authorIconUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  fields?: DiscordEmbedField[];
}

export type DiscordContainerBlock =
  | { kind: "text"; content: string }
  | { kind: "images"; urls: string[] }
  | { kind: "separator"; large?: boolean; divider?: boolean }
  | { kind: "buttons"; buttons: DiscordButton[] };

export interface DiscordContainer {
  accentColor?: number;
  spoiler?: boolean;
  blocks: DiscordContainerBlock[];
}

export type DiscordNotificationInput =
  | { discordId: string; type?: "message"; message: string; images?: string[]; button?: DiscordButton }
  | { discordId: string; type: "embed"; embed: DiscordEmbed; button?: DiscordButton }
  | { discordId: string; type: "container"; container: DiscordContainer };

export type DiscordNotificationResult = { ok: true } | { ok: false; error: string };

/** Never throws — a network/API failure comes back as a result, not an exception. */
export async function sendDiscordNotification(input: DiscordNotificationInput): Promise<DiscordNotificationResult> {
  const url = baseUrl();
  const workerKey = process.env.DISCORD_NOTIFICATIONS_WORKER_KEY;
  if (!url || !workerKey) return { ok: false, error: "not_configured" };

  try {
    const response = await resolveFetch()(`${url}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerKey}` },
      body: JSON.stringify({ ...input, service: SERVICE_NAME }),
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) {
      console.warn(`[discord-notifications-client] request failed with status ${response.status}`, body.error);
      return { ok: false, error: body.error ?? "request_failed" };
    }
    return { ok: true };
  } catch (error) {
    console.warn("[discord-notifications-client] request threw", error);
    return { ok: false, error: "request_failed" };
  }
}
