/**
 * GC-Stats — plant module
 *
 * Extracts bomb plant/defuse info (site, location, time, planter and
 * defuser) from a round result.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotRoundResultDto } from "./types";

export interface PlantInfo {
  planted: boolean;
  plantSite: string | null;
  plantX: number | null;
  plantY: number | null;
  plantTimeMs: number | null;
  planterPuuid: string | null;
  defused: boolean;
  defuserPuuid: string | null;
}

export function extractPlantInfo(round: RiotRoundResultDto): PlantInfo {
  const planted = Boolean(round.bombPlanter);
  return {
    planted,
    plantSite: round.plantSite || null,
    plantX: planted ? (round.plantLocation?.x ?? null) : null,
    plantY: planted ? (round.plantLocation?.y ?? null) : null,
    plantTimeMs: planted ? round.plantRoundTime : null,
    planterPuuid: round.bombPlanter,
    defused: Boolean(round.bombDefuser),
    defuserPuuid: round.bombDefuser,
  };
}
