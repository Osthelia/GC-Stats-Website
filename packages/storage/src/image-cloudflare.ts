/**
 * GC-Stats — image-cloudflare module
 *
 * Cloudflare Workers can't run sharp (native bindings); this mirrors
 * image.ts's sharp pipeline with the Cloudflare Images binding, used only
 * when DEPLOY_TARGET=cloudflare. Decoding and encoding run outside the
 * Worker isolate, so none of it counts toward the Worker's CPU time.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ImageFit, ImageValidationResult, WebpOptions } from "./image";

/** Subset of the `IMAGES` binding used here (the full type lives in the app's generated worker types). */
type ImagesBinding = {
  info(stream: ReadableStream<Uint8Array>): Promise<{ format: string; width?: number; height?: number }>;
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width?: number; height?: number; fit?: string; gravity?: string }): {
      output(options: { format: "image/webp"; quality?: number }): Promise<{ response(): Response }>;
    };
  };
};

function getImages(): ImagesBinding {
  const images = (getCloudflareContext().env as { IMAGES?: ImagesBinding }).IMAGES;
  if (!images) throw new Error("[image] IMAGES binding is not configured");
  return images;
}

function toStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return new Blob([new Uint8Array(buffer)]).stream();
}

const FIT_MAP: Record<ImageFit, string> = { cover: "cover", inside: "scale-down", contain: "contain" };

export async function decodeDimensions(buffer: Buffer): Promise<ImageValidationResult> {
  try {
    const { width, height } = await getImages().info(toStream(buffer));
    if (!width || !height) return { ok: false, error: "invalidImage" };
    return { ok: true, width, height };
  } catch {
    return { ok: false, error: "invalidImage" };
  }
}

export async function convertToWebp(input: Buffer, opts: WebpOptions): Promise<Buffer> {
  const hasSize = Boolean(opts.width || opts.height);
  const fit = opts.fit ?? "cover";
  const transformed = getImages()
    .input(toStream(input))
    .transform(hasSize ? { width: opts.width, height: opts.height, fit: FIT_MAP[fit], ...(fit === "cover" ? { gravity: "auto" } : {}) } : {});
  const result = await transformed.output({ format: "image/webp", quality: opts.quality });
  return Buffer.from(await result.response().arrayBuffer());
}
