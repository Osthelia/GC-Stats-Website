/**
 * GC-Stats - admin-entity-logo
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small square logo/photo with a fallback tile, shared by any admin list widget showing a team/player thumbnail. */
export function AdminEntityLogo({ src, alt, sizeClassName = "size-6" }: { src: string | null; alt: string; sizeClassName?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground", sizeClassName)}>
        <ImageOff className="size-3" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("shrink-0 rounded-md border object-contain", sizeClassName)} onError={() => setFailed(true)} />;
}
