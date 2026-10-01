/**
 * GC-Stats — image-cloudflare module
 *
 * Cloudflare Workers can't run sharp (native bindings); this mirrors
 * image.ts's sharp pipeline with Photon (WASM), used only when
 * DEPLOY_TARGET=cloudflare. Known behavior differences, accepted:
 * webp output has no quality setting (Photon only encodes lossless webp,
 * larger files than sharp's lossy `quality`), "cover" crop is centered
 * rather than sharp's saliency based `position: "attention"`, and there is
 * no automatic EXIF orientation correction.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { PhotonImage, SamplingFilter, resize, crop } from "@cf-wasm/photon/workerd";
import type { ImageFit, ImageValidationResult, WebpOptions } from "./image";

export function decodeDimensions(buffer: Buffer): ImageValidationResult {
  let img: PhotonImage | undefined;
  try {
    img = PhotonImage.new_from_byteslice(new Uint8Array(buffer));
    const width = img.get_width();
    const height = img.get_height();
    if (!width || !height) return { ok: false, error: "invalidImage" };
    return { ok: true, width, height };
  } catch {
    return { ok: false, error: "invalidImage" };
  } finally {
    img?.free();
  }
}

function applyFit(img: PhotonImage, targetWidth: number | undefined, targetHeight: number | undefined, fit: ImageFit): PhotonImage {
  const sw = img.get_width();
  const sh = img.get_height();

  if (fit === "contain") {
    throw new Error("contain fit is not implemented for the Cloudflare image pipeline (no current call site needs it)");
  }

  if (fit === "cover") {
    const tw = targetWidth ?? sw;
    const th = targetHeight ?? sh;
    const targetAspect = tw / th;
    const sourceAspect = sw / sh;

    let cropped = img;
    if (sourceAspect > targetAspect) {
      const cropWidth = Math.max(1, Math.round(sh * targetAspect));
      const x1 = Math.round((sw - cropWidth) / 2);
      cropped = crop(img, x1, 0, x1 + cropWidth, sh);
    } else if (sourceAspect < targetAspect) {
      const cropHeight = Math.max(1, Math.round(sw / targetAspect));
      const y1 = Math.round((sh - cropHeight) / 2);
      cropped = crop(img, 0, y1, sw, y1 + cropHeight);
    }

    const result = resize(cropped, Math.max(1, Math.round(tw)), Math.max(1, Math.round(th)), SamplingFilter.Lanczos3);
    if (cropped !== img) cropped.free();
    return result;
  }

  // "inside": scale to fit within the given bound(s), preserving aspect, no crop
  const scale = Math.min(targetWidth ? targetWidth / sw : Infinity, targetHeight ? targetHeight / sh : Infinity);
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  return resize(img, tw, th, SamplingFilter.Lanczos3);
}

export function convertToWebp(input: Buffer, opts: WebpOptions): Buffer {
  const decoded = PhotonImage.new_from_byteslice(new Uint8Array(input));
  let current = decoded;
  try {
    if (opts.width || opts.height) {
      const fitted = applyFit(current, opts.width, opts.height, opts.fit ?? "cover");
      current = fitted;
    }
    return Buffer.from(current.get_bytes_webp());
  } finally {
    current.free();
    if (current !== decoded) decoded.free();
  }
}
