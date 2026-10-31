/**
 * GC-Stats - api
 *
 * Minimal Discord REST client of the bot: posts and edits Components V2 messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const DISCORD_API = "https://discord.com/api/v10";
const REQUEST_TIMEOUT_MS = 10_000;

// Components V2 payload (a container and its children), the message carries no embed nor plain content.
export type DiscordComponent = Record<string, unknown>;

// Flag that makes Discord read `components` as Components V2.
const IS_COMPONENTS_V2 = 1 << 15;

/** Image sent with a message, referenced by `attachment://<filename>` in an embed. */
export type DiscordAttachment = { filename: string; data: Buffer; contentType: string };

export type DiscordSendResult =
  | { ok: true; messageId: string }
  // `permanent`: the bot lost access to the channel or the message, retrying is pointless.
  // `gone`: Discord answered 404 (unknown channel or message), on an edit only the message is lost.
  | { ok: false; permanent: boolean; gone?: boolean; error: string };

async function discordRequest(token: string | null, method: "POST" | "PATCH", path: string, components: DiscordComponent[], attachment?: DiscordAttachment, removeAttachments = false): Promise<DiscordSendResult> {
  if (!token) return { ok: false, permanent: false, error: "bot token not configured" };
  try {
    const headers: Record<string, string> = { Authorization: `Bot ${token}`, "User-Agent": "GCStatsBot (https://gc-stats.app, 1.0)" };
    // An empty list deletes the files the message already carries, leaving the field out keeps them.
    const body = { flags: IS_COMPONENTS_V2, components, allowed_mentions: { parse: [] }, ...(removeAttachments ? { attachments: [] } : {}) };
    let payload: string | FormData;
    if (attachment) {
      // On an edit, listing the attachment replaces the previous image.
      payload = new FormData();
      payload.append("payload_json", JSON.stringify({ ...body, attachments: [{ id: 0, filename: attachment.filename }] }));
      payload.append("files[0]", new Blob([new Uint8Array(attachment.data)], { type: attachment.contentType }), attachment.filename);
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const response = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      // 403 missing access, 404 unknown channel or message, 10003/10008 deleted: the target is gone.
      return { ok: false, permanent: response.status === 403 || response.status === 404, gone: response.status === 404, error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as { id?: string };
    if (!data.id) return { ok: false, permanent: false, error: "no message id in response" };
    return { ok: true, messageId: data.id };
  } catch (error) {
    return { ok: false, permanent: false, error: error instanceof Error ? error.message.slice(0, 200) : "request failed" };
  }
}

export function postChannelMessage(token: string | null, channelId: string, components: DiscordComponent[], attachment?: DiscordAttachment): Promise<DiscordSendResult> {
  return discordRequest(token, "POST", `/channels/${encodeURIComponent(channelId)}/messages`, components, attachment);
}

/** `removeAttachments` drops the image of the message when no new `attachment` replaces it. */
export function editChannelMessage(token: string | null, channelId: string, messageId: string, components: DiscordComponent[], attachment?: DiscordAttachment, removeAttachments = false): Promise<DiscordSendResult> {
  return discordRequest(token, "PATCH", `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, components, attachment, removeAttachments);
}

export type DiscordBotIdentity = { userId: string; name: string; avatarUrl: string | null };

/** Bot behind a token, null when Discord rejects it. */
export async function fetchBotIdentity(token: string): Promise<DiscordBotIdentity | null> {
  try {
    const response = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; username?: string; avatar?: string | null; bot?: boolean };
    if (!user.id || !user.username || !user.bot) return null;
    return { userId: user.id, name: user.username, avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null };
  } catch {
    return null;
  }
}
