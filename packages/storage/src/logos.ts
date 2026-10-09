/**
 * GC-Stats — logos module
 *
 * Stores, replaces, and deletes logo pairs (full size + 200x200 thumbnail,
 * both webp) for teams, people, tournaments, news authors, and
 * organizations, one storage folder per entity type.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { randomUUID } from "node:crypto";
import { convertToWebp } from "./image";
import { putObject, deleteObjects, publicUrl, tryPublicUrl } from "./s3";

// Folder per polymorphic `logos.entity_type` — mirrors V1's
// HasLogo::logoStorageFolder() per model. Extend as more entity types get a
// real upload flow. No "news-publisher" folder: publishers are organizations
// now (see schema/content.ts), which already have their own folder below.
export const LOGO_FOLDERS = {
  team: "teams",
  person: "people",
  tournament: "tournaments",
  "news-author": "news-authors",
  organization: "organizations",
} as const;

export type LogoEntityType = keyof typeof LOGO_FOLDERS;
export type LogoVariant = "full" | "200x200";

const THUMB_SIZE = 200;
const THUMB_QUALITY = 80;
const FULL_QUALITY = 90;

export type StoredLogo = {
  id: string;
  fullUrl: string;
  thumbnailUrl: string;
};

function logoKey(entityType: LogoEntityType, id: string, variant: LogoVariant): string {
  return `${LOGO_FOLDERS[entityType]}/${id}/${variant === "full" ? "full" : "200x200"}.webp`;
}

async function encodePair(buffer: Buffer): Promise<{ full: Buffer; thumb: Buffer }> {
  const [full, thumb] = await Promise.all([
    convertToWebp(buffer, { quality: FULL_QUALITY }),
    convertToWebp(buffer, { width: THUMB_SIZE, height: THUMB_SIZE, quality: THUMB_QUALITY, fit: "cover" }),
  ]);
  return { full, thumb };
}

export type StoreLogoError = "processingFailed" | "storageFailed";
export type StoreLogoResult = { ok: true; logo: StoredLogo } | { ok: false; error: StoreLogoError };

/** Same as storeLogoPair, but returns the failure cause (conversion vs storage) instead of throwing, and logs the real error server side. */
export async function tryStoreLogoPair(entityType: LogoEntityType, buffer: Buffer): Promise<StoreLogoResult> {
  const id = randomUUID();

  console.log(`[logo-trace] storage converting (${entityType})`, { inputBytes: buffer.byteLength });
  let encoded: { full: Buffer; thumb: Buffer };
  try {
    encoded = await encodePair(buffer);
  } catch (error) {
    console.error(`[logos] webp conversion failed (${entityType})`, error);
    return { ok: false, error: "processingFailed" };
  }
  console.log(`[logo-trace] storage converted (${entityType})`, { fullBytes: encoded.full.byteLength, thumbBytes: encoded.thumb.byteLength });

  const fullKey = logoKey(entityType, id, "full");
  const thumbKey = logoKey(entityType, id, "200x200");
  try {
    await Promise.all([putObject(fullKey, encoded.full, "image/webp"), putObject(thumbKey, encoded.thumb, "image/webp")]);
  } catch (error) {
    console.error(`[logos] storage upload failed (${entityType})`, error);
    await deleteObjects([fullKey, thumbKey]).catch(() => {});
    return { ok: false, error: "storageFailed" };
  }
  console.log(`[logo-trace] storage uploaded (${entityType})`, { fullKey, thumbKey });

  return { ok: true, logo: { id, fullUrl: publicUrl(fullKey), thumbnailUrl: publicUrl(thumbKey) } };
}

/** Same as replaceLogoFiles, but returns the failure cause instead of throwing. */
export async function tryReplaceLogoFiles(entityType: LogoEntityType, id: string, buffer: Buffer): Promise<{ ok: true } | { ok: false; error: StoreLogoError }> {
  let encoded: { full: Buffer; thumb: Buffer };
  try {
    encoded = await encodePair(buffer);
  } catch (error) {
    console.error(`[logos] webp conversion failed (${entityType})`, error);
    return { ok: false, error: "processingFailed" };
  }
  try {
    await Promise.all([
      putObject(logoKey(entityType, id, "full"), encoded.full, "image/webp"),
      putObject(logoKey(entityType, id, "200x200"), encoded.thumb, "image/webp"),
    ]);
  } catch (error) {
    console.error(`[logos] storage upload failed (${entityType})`, error);
    return { ok: false, error: "storageFailed" };
  }
  return { ok: true };
}

/** Mirrors V1 LogoUploadService::storeLogoPair — a full-size WebP plus a 200x200 cropped thumbnail, both under a fresh uuid folder. The uuid becomes the `logos.id` row so DB and storage stay keyed together. */
export async function storeLogoPair(entityType: LogoEntityType, buffer: Buffer): Promise<StoredLogo> {
  const id = randomUUID();
  const { full, thumb } = await encodePair(buffer);

  const fullKey = logoKey(entityType, id, "full");
  const thumbKey = logoKey(entityType, id, "200x200");

  await Promise.all([putObject(fullKey, full, "image/webp"), putObject(thumbKey, thumb, "image/webp")]);

  return { id, fullUrl: publicUrl(fullKey), thumbnailUrl: publicUrl(thumbKey) };
}

/** Overwrites the image bytes of an existing logo row in place (same uuid, same keys) — used when editing a logo entry rather than creating a new one. */
export async function replaceLogoFiles(entityType: LogoEntityType, id: string, buffer: Buffer): Promise<void> {
  const { full, thumb } = await encodePair(buffer);
  await Promise.all([
    putObject(logoKey(entityType, id, "full"), full, "image/webp"),
    putObject(logoKey(entityType, id, "200x200"), thumb, "image/webp"),
  ]);
}

export async function deleteLogoFiles(entityType: LogoEntityType, id: string): Promise<void> {
  await deleteObjects([logoKey(entityType, id, "full"), logoKey(entityType, id, "200x200")]);
}

/**
 * Convention-based URL (no `url` column on `logos` — see
 * packages/db/src/schema/people.ts) so any code that only has entityType+id
 * can still resolve a src. Returns null instead of throwing when S3 isn't
 * configured yet, so list/detail pages keep rendering (just without images)
 * until a real bucket exists.
 */
export function logoUrl(entityType: LogoEntityType, id: string, variant: LogoVariant = "200x200"): string | null {
  return tryPublicUrl(logoKey(entityType, id, variant));
}
