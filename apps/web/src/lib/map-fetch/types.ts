/**
 * GC-Stats - types
 *
 * Shared result/error types for the map-fetch pipeline (fetch-map-data.ts
 * and its helpers), so every step can return a typed failure instead of
 * throwing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotRelayError } from "@/lib/riot-relay-client";
import type { MissingPuuidPlayer } from "./identity-resolution";

export type FetchMapError =
  | { kind: "mapNotFound" }
  | { kind: "noMatchId" }
  | { kind: "entrantsNotSet" }
  | { kind: "regionNotConfigured" }
  | { kind: "relay"; relayError: RiotRelayError }
  | { kind: "invalidResponse" }
  | { kind: "missingPuuids"; players: MissingPuuidPlayer[] }
  | { kind: "teamColorAmbiguous"; rosters: TeamColorRoster[] }
  | { kind: "puuidConflict" }
  | { kind: "duplicateMatchId" };

export interface TeamColorRoster {
  color: "Red" | "Blue";
  players: { displayName: string; agentName: string }[];
}

export type FetchMapResult = { ok: true } | { ok: false; error: FetchMapError };
