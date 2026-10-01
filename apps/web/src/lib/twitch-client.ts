/**
 * GC-Stats - twitch-client
 *
 * Twitch Helix client using an app access token (client credentials grant,
 * same TWITCH_CLIENT_ID/SECRET already used for OAuth login). Used to
 * detect player POV streams (see
 * lib/scheduled-jobs/jobs/detect-player-pov-streams.ts). Mirrors V1's
 * App\Services\TwitchService, minus the Redis cache, this process is
 * long-lived (self-hosted, single Node server), so a module-level variable
 * is enough to avoid re-requesting a token on every run.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
const MAX_LOGINS_PER_REQUEST = 100;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // Twitch app tokens last ~60 days, refreshed well before that.

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAppAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", body: params });
  if (!response.ok) {
    console.warn(`[twitch-client] app access token request failed with status ${response.status}`);
    return null;
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) return null;

  cachedToken = { value: data.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return cachedToken.value;
}

export type LiveStream = { title: string; url: string };

/** Currently live streams among the given Twitch logins, keyed by lowercased login. */
export async function getLiveStreams(logins: string[]): Promise<Map<string, LiveStream>> {
  const uniqueLogins = [...new Set(logins.map((l) => l.trim().toLowerCase()).filter(Boolean))];
  if (uniqueLogins.length === 0) return new Map();

  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getAppAccessToken();
  if (!clientId || !token) return new Map();

  const results = new Map<string, LiveStream>();

  for (let i = 0; i < uniqueLogins.length; i += MAX_LOGINS_PER_REQUEST) {
    const chunk = uniqueLogins.slice(i, i + MAX_LOGINS_PER_REQUEST);
    const searchParams = new URLSearchParams();
    for (const login of chunk) searchParams.append("user_login", login);
    searchParams.set("first", "100");

    const response = await fetch(`https://api.twitch.tv/helix/streams?${searchParams.toString()}`, {
      headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.warn(`[twitch-client] get-streams call failed with status ${response.status}`);
      continue;
    }

    const body = (await response.json()) as { data?: Array<{ user_login?: string; title?: string }> };
    for (const stream of body.data ?? []) {
      const login = stream.user_login?.toLowerCase();
      if (!login) continue;
      results.set(login, { title: stream.title ?? "", url: `https://twitch.tv/${login}` });
    }
  }

  return results;
}
