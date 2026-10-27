/**
 * GC-Stats - import-game
 *
 * Entry point for one LoL game import: checks the match and timeline, loads the champion names of its patch
 * and checks that they name every champion of the game, keeps the raw pair in the LoL imports bucket (when
 * the game has a source), then stores the game. The Leaguepedia fetch is the caller. Like fetchMapData for
 * Valorant, it is the only place that gathers the inputs for the store.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { missingChampionIds, resolvePlayerRoles, validateImport } from "@gc-stats/lol-stats-engine";
import { storeLolImport } from "@gc-stats/storage";
import { getChampionCatalog, storeMissingIcons } from "@/lib/data-dragon-client";
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

export type ImportGameError = { kind: "invalidUpload"; errors: string[] } | { kind: "dataDragonUnavailable" } | { kind: "unknownChampions"; ids: number[] } | { kind: "storageUnavailable" };

export type ImportGameResult = { ok: true; gameId: number } | { ok: false; error: ImportGameError };

/** Store errors (unmapped participant, game already in another series) are thrown, as storeGameData does. */
export async function importGame(input: ImportGameInput): Promise<ImportGameResult> {
  const validation = validateImport(input.match, input.timeline);
  if (!validation.ok) return { ok: false, error: { kind: "invalidUpload", errors: validation.errors } };

  // Checked before anything is written: a game whose champions are not named would be stored with placeholders.
  const names = await getChampionCatalog(validation.match.info.gameVersion);
  if (!names.ok) return { ok: false, error: { kind: "dataDragonUnavailable" } };
  const missing = missingChampionIds(validation.match, names.catalog.championNameById);
  if (missing.length > 0) return { ok: false, error: { kind: "unknownChampions", ids: missing } };

  // The raw pair is written before the store, so a store that fails (an unmapped player, say) still keeps the file.
  if (input.source) {
    try {
      await storeLolImport(input.source, validation.match.metadata.matchId, { match: validation.match, timeline: validation.timeline });
    } catch (err) {
      console.error(`[lol-import] could not store game ${validation.match.metadata.matchId} in the imports bucket`, err);
      return { ok: false, error: { kind: "storageUnavailable" } };
    }
  }

  const { gameId } = await storeGameData({
    matchId: input.matchId,
    order: input.order,
    match: validation.match,
    timeline: validation.timeline,
    source: input.source,
    entrantIdBySide: input.entrantIdBySide,
    personIdByPuuid: input.personIdByPuuid,
    championNameById: names.catalog.championNameById,
    roleByParticipantId: resolvePlayerRoles(validation.match, validation.timeline, input.roleOverrides ?? {}),
    roleOverrides: input.roleOverrides ?? {},
    replaceGameId: input.replaceGameId ?? null,
  });
  // After the store: a missing icon never stops a game from being stored, and never throws.
  await storeMissingIcons(validation.match, names.catalog);
  return { ok: true, gameId };
}
