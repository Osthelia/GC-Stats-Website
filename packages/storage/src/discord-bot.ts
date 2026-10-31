/**
 * GC-Stats - discord-bot storage
 *
 * Background images of the Discord bot alert templates.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { randomUUID } from "node:crypto";
import { convertToWebp } from "./image";
import { putObject, deleteObject, publicUrl } from "./s3";

const MAX_WIDTH = 2000;
const QUALITY = 85;

function backgroundKey(id: string): string {
  return `discord-bot/${id}/background.webp`;
}

export type StoredDiscordBackground = { id: string; url: string };

export async function storeDiscordBackground(buffer: Buffer): Promise<StoredDiscordBackground> {
  const id = randomUUID();
  const webp = await convertToWebp(buffer, { width: MAX_WIDTH, quality: QUALITY, fit: "inside", animated: false });
  const key = backgroundKey(id);
  await putObject(key, webp, "image/webp");
  return { id, url: publicUrl(key) };
}

export async function deleteDiscordBackground(id: string): Promise<void> {
  await deleteObject(backgroundKey(id));
}

export function discordBackgroundUrl(id: string): string {
  return publicUrl(backgroundKey(id));
}
