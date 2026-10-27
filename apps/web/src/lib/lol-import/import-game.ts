/**
 * GC-Stats - import-game
 *
 * Entry point for one LoL game import: checks the match and timeline, keeps the raw pair in the LoL
 * imports bucket (when the game has a source), loads the Data Dragon champion names, then stores the
 * game. The upload action and the Leaguepedia fetch both call this and do nothing else with the data.
 * Like fetchMapData for Valorant, it is the only place that gathers the inputs for the store.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { resolvePlayerRoles, validateImport } from "@gc-stats/lol-stats-engine";
import { storeLolImport } from "@gc-stats/storage";
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
  /** The admin's role overrides by puuid. Players without one get the inferred role. */
  roleOverrides?: Record<string, string | null>;
  /** The game being edited, when the save replaces it. */
  replaceGameId?: number | null;
}

export type ImportGameResult = { ok: true; gameId: number } | { ok: false; error: { kind: "invalidUpload"; errors: string[] } };

/** Store errors (unmapped participant, game already in another series) are thrown, as storeGameData does. */
export async function importGame(input: ImportGameInput): Promise<ImportGameResult> {
  const validation = validateImport(input.match, input.timeline);
  if (!validation.ok) return { ok: false, error: { kind: "invalidUpload", errors: validation.errors } };

  // The raw pair is written before the store, so a store that fails (an unmapped player, say) still keeps the file.
  if (input.source) {
    await storeLolImport(input.source, validation.match.metadata.matchId, { match: validation.match, timeline: validation.timeline });
  }

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
    roleByParticipantId: resolvePlayerRoles(validation.match, validation.timeline, input.roleOverrides ?? {}),
    roleOverrides: input.roleOverrides ?? {},
    replaceGameId: input.replaceGameId ?? null,
  });
  return { ok: true, gameId };
}
