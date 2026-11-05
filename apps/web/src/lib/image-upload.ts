/**
 * GC-Stats - image-upload
 *
 * Client side image constraints (one preset per kind of upload) and the
 * canvas export used by the crop dialog. The server stays the source of
 * truth, these limits only mirror what it enforces to fail early.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { PHOTO_ACCEPT, PHOTO_MAX_MB, PHOTO_MIN_SIDE } from "@/lib/change-request-fields";

export type ImagePreset = {
  /** Accepted mime types. */
  accept: readonly string[];
  maxMb: number;
  /** Shortest side, in px, below which the source is refused. */
  minSide: number;
  /** Width / height of the crop frame. */
  aspect: number;
  /** Label shown to the user, matches `aspect`. */
  ratioLabel: string;
  /** Longest side of the exported image, larger crops are downscaled. */
  outputMax: number;
  /** Lets the crop frame extend past the image (transparent margin) and zoom out far. */
  allowPadding: boolean;
  /** Animated gifs skip the crop, the canvas would flatten them. */
  keepGif: boolean;
};

const RASTER = ["image/png", "image/jpeg", "image/webp"] as const;

export const IMAGE_PRESETS = {
  logo: { accept: RASTER, maxMb: 10, minSide: 100, aspect: 1, ratioLabel: "1:1", outputMax: 1024, allowPadding: true, keepGif: false },
  photo: { accept: PHOTO_ACCEPT.split(","), maxMb: PHOTO_MAX_MB, minSide: PHOTO_MIN_SIDE, aspect: 1, ratioLabel: "1:1", outputMax: 1200, allowPadding: true, keepGif: false },
  cover: { accept: [...RASTER, "image/gif"], maxMb: 10, minSide: 400, aspect: 16 / 9, ratioLabel: "16:9", outputMax: 1600, allowPadding: true, keepGif: true },
  article: { accept: RASTER, maxMb: 10, minSide: 400, aspect: 16 / 9, ratioLabel: "16:9", outputMax: 1600, allowPadding: true, keepGif: false },
  emote: { accept: [...RASTER, "image/gif"], maxMb: 10, minSide: 32, aspect: 1, ratioLabel: "1:1", outputMax: 512, allowPadding: true, keepGif: true },
} as const satisfies Record<string, ImagePreset>;

export type ImagePresetName = keyof typeof IMAGE_PRESETS;

export type ImageSourceError = "invalidType" | "tooLarge" | "tooSmall" | "invalidImage";

export type Area = { x: number; y: number; width: number; height: number };

export function formatLabel(mime: string): string {
  return mime.replace("image/", "").toUpperCase();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

/** Checks a picked file against the preset, returns the decoded size when it passes. */
export async function checkImageSource(file: File, preset: ImagePreset): Promise<{ ok: true; width: number; height: number } | { ok: false; error: ImageSourceError }> {
  if (!preset.accept.includes(file.type)) return { ok: false, error: "invalidType" };
  if (file.size > preset.maxMb * 1024 * 1024) return { ok: false, error: "tooLarge" };

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (Math.min(img.naturalWidth, img.naturalHeight) < preset.minSide) return { ok: false, error: "tooSmall" };
    return { ok: true, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return { ok: false, error: "invalidImage" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws the cropped area (which may extend past the image) and downscales it to `outputMax`. */
export async function exportCrop(src: string, area: Area, preset: ImagePreset, name: string): Promise<File> {
  const img = await loadImage(src);
  const scale = Math.min(1, preset.outputMax / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, -area.x * scale, -area.y * scale, img.naturalWidth * scale, img.naturalHeight * scale);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.95));
  if (!blob) throw new Error("canvas export failed");

  // Safari cannot encode webp and falls back to png, the extension follows the real type.
  const ext = blob.type === "image/png" ? "png" : "webp";
  return new File([blob], `${name.replace(/\.[^.]+$/, "") || "image"}.${ext}`, { type: blob.type });
}
