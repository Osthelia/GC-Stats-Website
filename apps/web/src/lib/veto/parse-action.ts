/**
 * GC-Stats - veto-parse-action
 *
 * Validates the JSON body of a team veto action.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { VetoAction } from "./service";

export function parseVetoAction(body: unknown): { matchId: number; action: VetoAction } | null {
  if (typeof body !== "object" || body === null) return null;
  const { matchId, type, ready, who, kind, mapName, side } = body as Record<string, unknown>;
  if (typeof matchId !== "number" || !Number.isInteger(matchId) || matchId <= 0) return null;

  if (type === "ready" && typeof ready === "boolean") return { matchId, action: { type, ready } };
  if (type === "chooseFirst" && (who === "self" || who === "opponent")) return { matchId, action: { type, who } };
  if (type === "finished") return { matchId, action: { type } };
  if (type === "play") {
    if ((kind === "ban" || kind === "pick") && typeof mapName === "string" && mapName.length <= 40) return { matchId, action: { type, action: { kind, mapName } } };
    if (kind === "side" && (side === "atk" || side === "def")) return { matchId, action: { type, action: { kind, side } } };
  }
  return null;
}
