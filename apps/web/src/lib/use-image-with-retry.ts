/**
 * GC-Stats - use-image-with-retry
 *
 * React hook for <img> elements that retries once with a cache busting
 * query param on load failure, then falls back to a failed state.
 * Works around an SSR/hydration race where the browser can fail to load
 * an image before onError is attached, permanently marking it broken.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";

function withCacheBust(src: string): string {
  return `${src}${src.includes("?") ? "&" : "?"}retry=${Date.now()}`;
}

/**
 * SSR renders <img> with its real src, so the browser starts loading it
 * before hydration attaches onError — a transient failure (seen in prod:
 * occasional 503 from the emote/logo CDN under burst load, e.g. an admin
 * table requesting 50 images at once) can fire before any handler exists to
 * catch it, and the browser then treats that exact URL as permanently
 * broken for the rest of the page's life, even though a fresh request
 * succeeds. Detects that race on mount and retries once with a cache
 * busted URL before falling back.
 */
export function useImageWithRetry(src: string | null) {
  const [attemptSrc, setAttemptSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const retriedRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setAttemptSrc(src);
    setFailed(false);
    retriedRef.current = false;
  }, [src]);

  function handleError() {
    if (!retriedRef.current && src) {
      retriedRef.current = true;
      setAttemptSrc(withCacheBust(src));
      return;
    }
    setFailed(true);
  }

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) handleError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptSrc]);

  return { imgRef, attemptSrc, failed, handleError };
}
