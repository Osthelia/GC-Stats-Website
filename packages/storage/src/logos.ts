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
