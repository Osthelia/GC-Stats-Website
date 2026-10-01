/**
 * GC-Stats - team-maps
 *
 * Server action loading the matches of one composition on the team Maps tab.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { getTeamMapCompMatches, type TeamMapCompMatch } from "@/lib/team-maps-data";
import { isValidMapsFilters, type MapsFilters } from "@/lib/maps-filters";

export type LoadTeamCompMatchesResult = { ok: true; matches: TeamMapCompMatch[] } | { ok: false; error: "invalidTeam" | "invalidMap" | "invalidAgents" | "invalidFilters" };

const MAX_NAME_LENGTH = 64;
const MAX_AGENTS = 10;

const isShortString = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_NAME_LENGTH;

export async function loadTeamCompMatches(teamId: number, mapName: string, agents: string[], filters: MapsFilters): Promise<LoadTeamCompMatchesResult> {
  if (!Number.isInteger(teamId) || teamId <= 0) return { ok: false, error: "invalidTeam" };
  if (!isShortString(mapName)) return { ok: false, error: "invalidMap" };
  if (!Array.isArray(agents) || agents.length < 5 || agents.length > MAX_AGENTS || !agents.every(isShortString)) {
    return { ok: false, error: "invalidAgents" };
  }
  if (!isValidMapsFilters(filters)) return { ok: false, error: "invalidFilters" };
  return { ok: true, matches: await getTeamMapCompMatches(teamId, mapName, agents, filters) };
}
