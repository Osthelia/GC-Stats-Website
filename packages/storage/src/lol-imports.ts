/**
 * GC-Stats — lol-imports module
 *
 * The raw Riot Match-V5 match and timeline of each LoL game, gzipped in their own bucket
 * (S3_LOL_IMPORTS_BUCKET), keyed by source and Riot match id. This is the record that a new stat is
 * computed from, so a game can be reprocessed without asking Leaguepedia again. Separate from the
 * logos and news bucket: the data is public on Leaguepedia, so no access control is needed.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getObject, objectExists, putObject } from "./s3";

/** What is stored for one game. Untyped: the caller validates it before use (validateImport). */
export interface LolImportPayload {
  match: unknown;
  timeline: unknown;
}

/** Same values as lol_games.source. */
export type LolImportSource = "leaguepedia" | "riot";

// Riot match ids look like "LOLTMNT01_296476" or "EUW1_123". Checked before the id becomes an
// object key, so nothing else can end up in a path.
const RIOT_MATCH_ID = /^[A-Z0-9]+_[0-9]+$/;

export function getLolImportsBucket(): string {
  const bucket = process.env.S3_LOL_IMPORTS_BUCKET;
  if (!bucket) throw new Error("Missing required env var S3_LOL_IMPORTS_BUCKET for @gc-stats/storage");
  return bucket;
}

/**
 * The source is part of the key. Leaguepedia and Riot deliver the same Match-V5 format for the same
 * match id, so without it a later Riot fetch would overwrite the Leaguepedia file.
 */
export function lolImportKey(source: LolImportSource, riotMatchId: string): string {
  if (!RIOT_MATCH_ID.test(riotMatchId)) throw new Error(`Not a Riot match id: ${JSON.stringify(riotMatchId)}`);
  return `${source}/${riotMatchId}.json.gz`;
}

export async function storeLolImport(source: LolImportSource, riotMatchId: string, payload: LolImportPayload): Promise<void> {
  const body = await gzipJson(payload);
  await putObject(lolImportKey(source, riotMatchId), Buffer.from(body), "application/gzip", getLolImportsBucket());
}

/** The stored payload, or null when the game has not been stored yet. */
export async function readLolImport(source: LolImportSource, riotMatchId: string): Promise<LolImportPayload | null> {
  const bytes = await getObject(lolImportKey(source, riotMatchId), getLolImportsBucket());
  if (!bytes) return null;
  return (await gunzipJson(bytes)) as LolImportPayload;
}

export async function lolImportExists(source: LolImportSource, riotMatchId: string): Promise<boolean> {
  return objectExists(lolImportKey(source, riotMatchId), getLolImportsBucket());
}

/** Web streams, so it runs the same on Node and on Workers. */
export async function gzipJson(value: unknown): Promise<Uint8Array> {
  const compressed = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

export async function gunzipJson(bytes: Uint8Array): Promise<unknown> {
  const decompressed = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(decompressed).text());
}
