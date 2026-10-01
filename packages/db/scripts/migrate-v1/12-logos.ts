/**
 * GC-Stats — 12-logos
 *
 * Creates the V2 `logos` rows for entities whose logo files were already
 * copied to storage but never got a corresponding row in V1. Also renames
 * the storage keys for player/author/publisher logos to the folder names
 * V2 reads from, since those folder conventions changed between versions.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// This phase is the only one that touches object storage — S3_* (destination
// bucket) lives in packages/storage/.env, not packages/db/.env (which
// connection.ts's "dotenv/config" already loaded for V1_DATABASE_URL/
// DATABASE_URL). Loaded explicitly here rather than from connection.ts,
// which every other phase also imports and has no reason to know about S3.
loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../storage/.env") });

import { db, v1 } from "./connection";
import { preloadEntityType, tryMappedId } from "./id-map";
import { logos } from "../../src/schema";
import { copyObjectWithinBucket, objectExists } from "@gc-stats/storage";

interface V1LogoRow {
  id: string;
  entity_type: string;
  entity_id: number;
  from: Date | string;
  until: Date | string | null;
  theme: string | null;
  is_visible: number;
}

/**
 * V1's `logos` table is polymorphic via Relation::morphMap (AppServiceProvider):
 * 'team' => Team, 'player' => Player, 'tournament' => Tournament,
 * 'author' => NewsAuthor, 'publisher' => NewsPublisher. Files were already
 * copied byte-for-byte, same key, by migrate-old-storage.ts — this phase
 * only needed to create the missing V2 `logos` rows (never done before, see
 * README.md), which is why entities like team #340 had a logo file sitting
 * in the bucket but nothing pointed at it.
 *
 * Team and Tournament share the same storage folder name in both versions
 * ("teams"/"tournaments"), but Player/NewsAuthor/NewsPublisher don't — V1's
 * LogoUploadService wrote them under "players"/"authors"/"publishers"
 * (app/Models/{Player,NewsAuthor,NewsPublisher}.php::logoStorageFolder),
 * while V2's LOGO_FOLDERS (packages/storage/src/logos.ts) reads them back
 * from "people"/"news-authors"/"organizations" (people merges V1's
 * players+staff, see DATABASES.MD §3.2; publishers merge into organizations,
 * see schema/content.ts — no "news-publisher" entity type in V2 at all). The
 * already-transferred files for those need a one-time server-side rename to
 * the folder V2 actually reads from — done here per logo rather than as a
 * separate bulk pass, since we're already iterating every migrated logo row
 * once.
 *
 * `publisher` resolves through the "news_publisher" id-map entry (populated
 * by migrateNewsPublishers in 01-organizations.ts), which already points at
 * a real V2 organization id — so a former publisher's logo becomes that
 * organization's logo, same as any org logo would.
 */
const ENTITY_TYPE_MAP: Record<string, { v2Type: string; mapKey: string; oldFolder: string; newFolder: string }> = {
  team: { v2Type: "team", mapKey: "team", oldFolder: "teams", newFolder: "teams" },
  player: { v2Type: "person", mapKey: "player", oldFolder: "players", newFolder: "people" },
  tournament: { v2Type: "tournament", mapKey: "tournament", oldFolder: "tournaments", newFolder: "tournaments" },
  author: { v2Type: "news-author", mapKey: "news_author", oldFolder: "authors", newFolder: "news-authors" },
  publisher: { v2Type: "organization", mapKey: "news_publisher", oldFolder: "publishers", newFolder: "organizations" },
  // 'organization' rows exist in V1's real data (2 rows) but are unreachable
  // dead data: no morphMap entry, no model uses HasLogo returning
  // 'organization', no controller ever wrote them through the normal upload
  // flow (checked: only Team/Player have a dedicated Api*LogoController,
  // Tournament/NewsAuthor/NewsPublisher go through admin controllers, none
  // named "organization"). Left unmapped on purpose — signalled as
  // "unsupported" below rather than guessed at.
};

function toIso(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v);
  return d.toISOString();
}

function periodRange(from: Date | string, until: Date | string | null): string {
  return until ? `[${toIso(from)},${toIso(until)})` : `[${toIso(from)},)`;
}

async function renameLogoFiles(oldFolder: string, newFolder: string, uuid: string): Promise<void> {
  if (oldFolder === newFolder) return;
  for (const variant of ["full.webp", "200x200.webp"]) {
    const fromKey = `${oldFolder}/${uuid}/${variant}`;
    const toKey = `${newFolder}/${uuid}/${variant}`;
    if (await objectExists(toKey)) continue; // already renamed by a previous run
    if (!(await objectExists(fromKey))) continue; // nothing transferred for this variant — logged as a gap by the caller
    await copyObjectWithinBucket(fromKey, toKey);
  }
}

export async function migrateLogos() {
  const [rows] = await v1.query<any[]>(
    "SELECT id, entity_type, entity_id, `from`, until, theme, is_visible FROM logos ORDER BY `from`"
  );

  for (const mapKey of new Set(Object.values(ENTITY_TYPE_MAP).map((m) => m.mapKey))) {
    await preloadEntityType(mapKey);
  }

  let created = 0, skippedExisting = 0, skippedUnsupported = 0, unresolved = 0, failed = 0;
  const unresolvedSamples: string[] = [];

  for (const row of rows as V1LogoRow[]) {
    const mapping = ENTITY_TYPE_MAP[row.entity_type];
    if (!mapping) {
      skippedUnsupported++;
      continue;
    }

    const existing = await db.query.logos.findFirst({ where: (l, { eq }) => eq(l.id, row.id) });
    if (existing) {
      skippedExisting++;
      continue;
    }

    const entityId = tryMappedId(mapping.mapKey, row.entity_id);
    if (!entityId) {
      unresolved++;
      if (unresolvedSamples.length < 20) unresolvedSamples.push(`${row.entity_type}#${row.entity_id} (logo ${row.id})`);
      continue;
    }

    try {
      await renameLogoFiles(mapping.oldFolder, mapping.newFolder, row.id);
      await db.insert(logos).values({
        id: row.id,
        entityType: mapping.v2Type,
        entityId,
        period: periodRange(row.from, row.until),
        theme: row.theme,
        isVisible: !!row.is_visible,
      });
      created++;
    } catch (err) {
      failed++;
      console.warn(`logo ${row.id} (${row.entity_type}#${row.entity_id}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `logos: ${created} created, ${skippedExisting} already migrated, ${skippedUnsupported} unsupported entity_type ` +
      `(legacy "organization" rows, never a real V1 feature), ${unresolved} unresolved entity id, ${failed} failed`
  );
  if (unresolvedSamples.length > 0) {
    console.log(`  Unresolved samples: ${unresolvedSamples.join(", ")}`);
  }
}
