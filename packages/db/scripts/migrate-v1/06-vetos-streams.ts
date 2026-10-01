/**
 * GC-Stats — 06-vetos-streams
 *
 * V1 to V2 migration step: migrates match map vetos, stream channels,
 * match streams, and VODs.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, and, sql } from "drizzle-orm";
import { db, v1 } from "./connection";
import { getMappedId, setMappedId, setMappedIdsBatch, preloadEntityType } from "./id-map";
import { matchVetos, streamChannels, matchStreams, vods } from "../../src/schema";

// entrants aren't keyed by their own legacy id — see 05's ENTRANT_KEY_MULTIPLIER.
const ENTRANT_KEY_MULTIPLIER = 10_000_000;
const entrantKey = (tournamentId: number, teamId: number) => tournamentId * ENTRANT_KEY_MULTIPLIER + teamId;

export async function migrateMatchVetos() {
  await preloadEntityType("match");
  await preloadEntityType("entrant");
  const [rows] = await v1.query<any[]>(
    `SELECT mv.id, mv.match_id, mv.team_id, mv.map_name, mv.type, mv.side, mv.order, mv.side_picked_by,
            m.tournament_id
     FROM match_vetos mv JOIN matches m ON m.id = mv.match_id`
  );

  const CHUNK = 500;
  let done = 0, skippedCount = 0, unresolved = 0;
  for (let i = 0; i < (rows as any[]).length; i += CHUNK) {
    const chunk = (rows as any[]).slice(i, i + CHUNK);
    const toInsert: { legacyId: number; matchId: number; entrantId: number; mapName: string; type: string;
      order: number; side: string | null; sidePickedByEntrantId: number | null }[] = [];
    for (const row of chunk) {
      if (await getMappedId("match_veto", row.id)) { skippedCount++; continue; }
      const matchId = await getMappedId("match", row.match_id);
      const entrantId = await getMappedId("entrant", entrantKey(row.tournament_id, row.team_id));
      if (!matchId || !entrantId) { unresolved++; continue; }
      const sidePickedByEntrantId = row.side_picked_by
        ? (await getMappedId("entrant", entrantKey(row.tournament_id, row.side_picked_by))) ?? null
        : null;
      toInsert.push({
        legacyId: row.id, matchId, entrantId, mapName: row.map_name, type: row.type,
        order: row.order, side: row.side, sidePickedByEntrantId,
      });
    }
    if (toInsert.length === 0) continue;
    await db.transaction(async (tx) => {
      const inserted = await tx.insert(matchVetos).values(toInsert.map((r) => ({
        matchId: r.matchId, entrantId: r.entrantId, mapName: r.mapName, type: r.type,
        order: r.order, side: r.side, sidePickedByEntrantId: r.sidePickedByEntrantId,
      }))).returning({ id: matchVetos.id });
      await setMappedIdsBatch("match_veto", toInsert.map((r, idx) => ({ legacyId: r.legacyId, newId: inserted[idx].id })), tx);
    });
    done += toInsert.length;
  }
  console.log(`match_vetos: ${done} created, ${skippedCount} already migrated, ${unresolved} unresolved`);
}

// A veto list with no ban is incomplete v1 data (the veto phase was cut
// short or never fully recorded) — nothing usable to display, so the whole
// match's veto rows are dropped rather than kept half-populated.
export async function pruneVetosWithoutBans() {
  const deleted = await db.execute(sql`
    DELETE FROM ${matchVetos}
    WHERE ${matchVetos.matchId} IN (
      SELECT ${matchVetos.matchId}
      FROM ${matchVetos}
      GROUP BY ${matchVetos.matchId}
      HAVING COUNT(*) FILTER (WHERE ${matchVetos.type} = 'ban') = 0
    )
  `);
  console.log(`match_vetos: ${deleted.rowCount ?? 0} rows deleted (no ban in match's veto list)`);
}

export async function migrateStreamsAndVods() {
  const [channelRows] = await v1.query<any[]>(
    "SELECT id, publisher_id, name, platform, url, language_code, is_active FROM stream_channels"
  );
  let channelsCreated = 0, channelsSkipped = 0;
  for (const row of channelRows as any[]) {
    if (await getMappedId("stream_channel", row.id)) { channelsSkipped++; continue; }
    const organizationId = row.publisher_id ? (await getMappedId("news_publisher", row.publisher_id)) ?? null : null;
    const [inserted] = await db.insert(streamChannels).values({
      organizationId, name: row.name, platform: row.platform, url: row.url,
      languageCode: row.language_code, isActive: !!row.is_active,
    }).returning({ id: streamChannels.id });
    await setMappedId("stream_channel", row.id, inserted.id);
    channelsCreated++;
  }
  console.log(`stream_channels: ${channelsCreated} created, ${channelsSkipped} already migrated`);

  const [msRows] = await v1.query<any[]>("SELECT match_id, stream_channel_id FROM match_streams");
  let msCreated = 0, msSkipped = 0, msUnresolved = 0;
  for (const row of msRows as any[]) {
    const matchId = await getMappedId("match", row.match_id);
    const streamChannelId = await getMappedId("stream_channel", row.stream_channel_id);
    if (!matchId || !streamChannelId) { msUnresolved++; continue; }
    const existing = await db.query.matchStreams.findFirst({
      where: and(eq(matchStreams.matchId, matchId), eq(matchStreams.streamChannelId, streamChannelId)),
    });
    if (existing) { msSkipped++; continue; }
    await db.insert(matchStreams).values({ matchId, streamChannelId });
    msCreated++;
  }
  console.log(`match_streams: ${msCreated} created, ${msSkipped} already migrated, ${msUnresolved} unresolved`);

  // vods.game_map_id references the (not-yet-migrated in this pass) `maps`
  // table — left null for now, patched by the stats migration phase later.
  const [vodRows] = await v1.query<any[]>(
    "SELECT id, match_id, publisher_id, url, language_code FROM vods"
  );
  let vodsCreated = 0, vodsSkipped = 0, vodsUnresolved = 0;
  for (const row of vodRows as any[]) {
    if (await getMappedId("vod", row.id)) { vodsSkipped++; continue; }
    const matchId = await getMappedId("match", row.match_id);
    if (!matchId) { vodsUnresolved++; continue; }
    const organizationId = row.publisher_id ? (await getMappedId("news_publisher", row.publisher_id)) ?? null : null;
    const [inserted] = await db.insert(vods).values({
      matchId, mapId: null, organizationId, url: row.url, languageCode: row.language_code,
    }).returning({ id: vods.id });
    await setMappedId("vod", row.id, inserted.id);
    vodsCreated++;
  }
  console.log(`vods: ${vodsCreated} created, ${vodsSkipped} already migrated, ${vodsUnresolved} unresolved`);
}
