/**
 * GC-Stats - forum-avatar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import Image from "next/image";

/** Same image-or-initial fallback treatment as the news article byline (news/[slug]/page.tsx). */
export function ForumAvatar({ username, image, size = 32 }: { username: string | null; image: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (username ?? "?").charAt(0).toUpperCase();
  return (
    <span
      className="flex flex-none items-center justify-center overflow-hidden rounded-full bg-white/[0.08] font-bold text-neutral-300"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {image && !failed ? (
        <Image src={image} alt="" width={size} height={size} className="h-full w-full object-cover" unoptimized onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </span>
  );
}
