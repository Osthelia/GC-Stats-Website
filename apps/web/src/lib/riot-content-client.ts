/**
 * GC-Stats - riot-content-client
 *
 * Riot's own official content API (val/content/v1/contents), distinct from
 * RiotRelay, called directly with RIOT_KEY. Resolves map/agent/weapon/armor
 * UUIDs to display names. Mirrors twitch-client.ts (module-level cache,
 * fail-open, never throws) rather than V1's Laravel file cache, since this
 * process is long-lived (self-hosted, single Node server).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotRelayRegion } from "./riot-relay-client";

export interface RiotContent {
  maps: Record<string, string>;
  agents: Record<string, string>;
  equips: Record<string, string>;
}

const CONTENT_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<RiotRelayRegion, { value: RiotContent; expiresAt: number }>();

const EMPTY_CONTENT: RiotContent = { maps: {}, agents: {}, equips: {} };

interface RiotContentApiItem {
  name: string;
  id?: string;
  assetPath?: string;
}
interface RiotContentApiResponse {
  maps?: RiotContentApiItem[];
  characters?: RiotContentApiItem[];
  equips?: RiotContentApiItem[];
}

export async function getRiotContent(region: RiotRelayRegion): Promise<RiotContent> {
  const cached = cache.get(region);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const apiKey = process.env.RIOT_KEY;
  if (!apiKey) return EMPTY_CONTENT;

  try {
    const response = await fetch(`https://${region}.api.riotgames.com/val/content/v1/contents?locale=en-US`, {
      headers: { "X-Riot-Token": apiKey },
    });
    if (!response.ok) {
      console.warn(`[riot-content] content request failed with status ${response.status}`);
      return EMPTY_CONTENT;
    }

    const body = (await response.json()) as RiotContentApiResponse;
    // Map keys are the assetPath (matchInfo.mapId) as-is, NOT lowercased.
    // Agent/equip keys are GUIDs, lowercased — an asymmetry in Riot's own
    // API, not a mistake here.
    const value: RiotContent = {
      maps: Object.fromEntries((body.maps ?? []).filter((m) => m.assetPath).map((m) => [m.assetPath!, m.name])),
      agents: Object.fromEntries((body.characters ?? []).filter((c) => c.id).map((c) => [c.id!.toLowerCase(), c.name])),
      equips: Object.fromEntries((body.equips ?? []).filter((e) => e.id).map((e) => [e.id!.toLowerCase(), e.name])),
    };

    cache.set(region, { value, expiresAt: Date.now() + CONTENT_TTL_MS });
    return value;
  } catch (err) {
    console.warn(`[riot-content] request error: ${err instanceof Error ? err.message : String(err)}`);
    return EMPTY_CONTENT;
  }
}

export function resolveMapName(content: RiotContent, mapAssetPath: string): string {
  return content.maps[mapAssetPath] ?? mapAssetPath;
}

export function resolveAgentName(content: RiotContent, characterId: string): string {
  return content.agents[characterId.toLowerCase()] ?? characterId;
}

/** Resolves both weapons and armor — Riot's content API merges them into one "equips" list. */
export function resolveEquipName(content: RiotContent, equipId: string): string {
  if (!equipId) return "";
  return content.equips[equipId.toLowerCase()] ?? equipId;
}
