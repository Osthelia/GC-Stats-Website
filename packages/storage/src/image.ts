/**
 * GC-Stats — image module
 *
 * Image processing helpers: converts uploads to webp with sharp and validates
 * that an upload decodes as a real raster image.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import sharp from "sharp";

export type ImageFit = "cover" | "contain" | "inside";

export type WebpOptions = {
  width?: number;
  height?: number;
  quality: number;
  /** "cover" scales so the *shortest* side fills the box and crops the rest — mirrors V1's custom scaleByShortestSide() helper, which sharp does natively. */
  fit?: ImageFit;
  /** Keeps every frame of an animated source (gif). */
  animated?: boolean;
};

export async function convertToWebp(input: Buffer, opts: WebpOptions): Promise<Buffer> {
  let pipeline = sharp(input, { failOn: "error", animated: opts.animated }).rotate(); // auto-orient from EXIF before any resize
  if (opts.width || opts.height) {
    // width-only (or height-only) call sites use fit:"inside" — no crop, just
    // a max-dimension cap, unlike the cover-thumbnail case below.
    pipeline = pipeline.resize(opts.width ?? null, opts.height ?? null, { fit: opts.fit ?? "cover", position: "attention" });
  }
  return pipeline.webp({ quality: opts.quality }).toBuffer();
}

export type ImageValidationError = "empty" | "tooLarge" | "invalidImage" | "processingFailed";
export type ImageValidationResult = { ok: true; width: number; height: number } | { ok: false; error: ImageValidationError };

/** 10 MB — mirrors V1's `ApiTeamLogoController::upload` validation (`max:10240` KB). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Decodes to confirm the upload is a real raster image, not just a file with an image-looking extension/mime type. */
export async function validateImageBuffer(buffer: Buffer): Promise<ImageValidationResult> {
  if (buffer.byteLength === 0) return { ok: false, error: "empty" };
  if (buffer.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "tooLarge" };

  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) return { ok: false, error: "invalidImage" };
    return { ok: true, width: metadata.width, height: metadata.height };
  } catch {
    return { ok: false, error: "invalidImage" };
  }
}
