/**
 * GC-Stats — news module
 *
 * News article images (cover + inline content images): same webp
 * conversion approach as logos.ts, but a single variant (no theme/
 * history). Keyed by the same uuid as the `news_images` row, so the DB row
 * and the object key stay tied together like NewsImage did in V1.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { randomUUID } from "node:crypto";
import { convertToWebp } from "./image";
import { putObject, deleteObject, publicUrl } from "./s3";

const MAX_WIDTH = 1600;
const QUALITY = 85;

function newsImageKey(id: string): string {
  return `news/${id}/image.webp`;
}

export type StoredNewsImage = { id: string; url: string };

export async function storeNewsImage(buffer: Buffer): Promise<StoredNewsImage> {
  const id = randomUUID();
  const webp = await convertToWebp(buffer, { width: MAX_WIDTH, quality: QUALITY, fit: "inside" });
  const key = newsImageKey(id);
  await putObject(key, webp, "image/webp");
  return { id, url: publicUrl(key) };
}

export async function deleteNewsImage(id: string): Promise<void> {
  await deleteObject(newsImageKey(id));
}

export function newsImageUrl(id: string): string {
  return publicUrl(newsImageKey(id));
}
