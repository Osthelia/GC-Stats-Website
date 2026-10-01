/**
 * GC-Stats - emote-image
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useImageWithRetry } from "@/lib/use-image-with-retry";

/** Every image needs a fallback (CLAUDE.md) — falls back to the emote's initial if the image is missing or fails to load. */
export function EmoteImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const { imgRef, attemptSrc, failed, handleError } = useImageWithRetry(src);
  if (failed) {
    return <span className={`${className} flex items-center justify-center text-[10px] font-semibold text-neutral-500`}>{alt.charAt(0).toUpperCase()}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={imgRef} src={attemptSrc ?? src} alt={alt} className={className} onError={handleError} />;
}
