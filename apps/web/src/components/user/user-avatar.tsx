/**
 * GC-Stats - user-avatar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";

/** User avatar with an initials fallback if the stored image URL fails to load. */
export function UserAvatar({ image, initial, className }: { image: string | null; initial: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (image && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={className} onError={() => setFailed(true)} />;
  }

  return (
    <span className="flex h-full w-full items-center justify-center text-[40px] font-black text-neutral-600">
      {initial}
    </span>
  );
}
