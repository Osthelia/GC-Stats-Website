/**
 * GC-Stats - themed-logo-image
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders a logo that follows the visitor's site theme (dark/light, see
 * lib/site-settings.tsx) — swapped purely via CSS ([data-site-theme] on
 * <html>, set before first paint) so there's never a client JS/hydration
 * flash. Renders a single <img> when both resolve to the same src, which is
 * the common case: most entities have no theme-specific logo uploaded yet.
 *
 * Falls back to a neutral tile if the stored URL 404s or otherwise fails to
 * load at runtime (file deleted from storage, CDN outage, etc.) — every logo
 * needs a fallback per CLAUDE.md, and the "no URL at all" case is already
 * handled by callers choosing not to render this component in the first
 * place.
 */
export function ThemedLogoImage({
  dark,
  light,
  alt,
  width,
  height,
  className,
}: {
  dark: string;
  light: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        style={{ width, height }}
      >
        <ImageOff className="size-1/2" />
      </div>
    );
  }

  if (dark === light) {
    return <Image src={dark} alt={alt} width={width} height={height} className={className} unoptimized onError={() => setFailed(true)} />;
  }

  return (
    <>
      <Image src={dark} alt={alt} width={width} height={height} className={cn(className, "site-light:hidden")} unoptimized onError={() => setFailed(true)} />
      <Image src={light} alt={alt} width={width} height={height} className={cn(className, "hidden site-light:block")} unoptimized onError={() => setFailed(true)} />
    </>
  );
}
