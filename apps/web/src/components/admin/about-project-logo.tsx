/**
 * GC-Stats - about-project-logo
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { ImageOff } from "lucide-react";
import { useImageWithRetry } from "@/lib/use-image-with-retry";

/** Every logo needs a fallback (CLAUDE.md) — falls back to a neutral icon tile if `src` is missing or fails to load. */
export function AboutProjectLogo({ src, alt }: { src: string | null; alt: string }) {
  const { imgRef, attemptSrc, failed, handleError } = useImageWithRetry(src);

  if (!src || failed) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <ImageOff className="size-4" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={imgRef} src={attemptSrc ?? src} alt={alt} className="size-10 shrink-0 rounded-md border object-contain" onError={handleError} />;
}
