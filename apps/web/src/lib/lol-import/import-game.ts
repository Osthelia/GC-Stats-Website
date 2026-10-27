/**
 * GC-Stats - import-game
 *
 * Entry point for one LoL game import: checks the uploaded match and timeline, loads the Data Dragon
 * champion names, then stores the game. The upload action calls this and does nothing else with the
 * data. Like fetchMapData for Valorant, it is the only place that gathers the inputs for the store.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { validateImport } from "@gc-stats/lol-stats-engine";
import { getDataDragonCatalog } from "@/lib/data-dragon-client";
import { storeGameData, type StoreGameInput } from "./store-game-data";

export interface ImportGameInput {
  matchId: number;
  order: number;
  /** The uploaded JSON, untrusted until validateImport has checked it. */
  match: unknown;
  /** The uploaded timeline JSON. Pass null for a game without one (chronobreak); undefined is rejected. */
  timeline: unknown;
  source: StoreGameInput["source"];
  entrantIdBySide: StoreGameInput["entrantIdBySide"];
  personIdByPuuid: StoreGameInput["personIdByPuuid"];
}

export type ImportGameResult = { ok: true; gameId: number } | { ok: false; error: { kind: "invalidUpload"; errors: string[] } };

/** Store errors (unmapped participant, game already in another series) are thrown, as storeGameData does. */
export async function importGame(input: ImportGameInput): Promise<ImportGameResult> {
  const validation = validateImport(input.match, input.timeline);
  if (!validation.ok) return { ok: false, error: { kind: "invalidUpload", errors: validation.errors } };

  const catalog = await getDataDragonCatalog();
  const { gameId } = await storeGameData({
    matchId: input.matchId,
    order: input.order,
    match: validation.match,
    timeline: validation.timeline,
    source: input.source,
    entrantIdBySide: input.entrantIdBySide,
    personIdByPuuid: input.personIdByPuuid,
    championNameById: catalog.championNameById,
  });
  return { ok: true, gameId };
}
