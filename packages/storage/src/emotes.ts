/**
 * GC-Stats — emotes module
 *
 * Storage helpers for emote images: resolves a stored key or external URL
 * to a public URL, and stores freshly uploaded emotes as-is (no webp
 * conversion, since many are animated GIFs).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { randomUUID } from "node:crypto";
import { putObject, deleteObject, publicUrl } from "./s3";

/**
 * `emotes.image_path` holds a storage key for every migrated V1 row (e.g.
 * "emotes/twemoji/1f004.svg") but the admin create/edit form asks for a full
 * URL for anything created directly in V2 — resolve both the same way rather
 * than forcing a one-time rewrite of ~4000 rows.
 */
export function emoteImageUrl(imagePath: string): string {
  return /^https?:\/\//i.test(imagePath) ? imagePath : publicUrl(imagePath);
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Extension-less keys resolve to whatever this returns — reject anything else before calling storeEmoteImage. */
export function isSupportedEmoteMime(contentType: string): boolean {
  return contentType in EXTENSION_BY_MIME;
}

export type StoredEmoteImage = { key: string; url: string };

/**
 * No webp conversion (unlike logos.ts/news.ts) — emotes are commonly
 * animated GIFs, converting to a single-frame webp would freeze them.
 * Stored as-is under the original mime type.
 */
export async function storeEmoteImage(buffer: Buffer, contentType: string): Promise<StoredEmoteImage> {
  const ext = EXTENSION_BY_MIME[contentType] ?? "png";
  const key = `emotes/uploads/${randomUUID()}.${ext}`;
  await putObject(key, buffer, contentType);
  return { key, url: publicUrl(key) };
}

/** Only ever called on a key this module produced (`imagePath` starting with "emotes/uploads/") — never on a migrated V1 path or an external URL. */
export async function deleteEmoteImageFile(key: string): Promise<void> {
  await deleteObject(key);
}
