/**
 * GC-Stats - lol-icon
 *
 * A League icon from the public bucket: a champion, an item or a rune. Styled like AgentIcon: a thin border on the surface
 * colour, lazy loading, and the name as tooltip. A champion's artwork has a dark frame baked in, so it is cropped to hide
 * that frame and gets no border of its own. Runes are round; a rune tree's emblem is shown whole, without the frame. An
 * icon that is not stored yet (or fails to load) shows a tile with the name's first letter instead.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";

type Props = {
  kind: "champion" | "item" | "rune" | "tree";
  url: string | null;
  /** The champion, item or rune name: for alt text and the hover tooltip */
  name: string;
  /** Pixels, or a CSS length such as a variable when the size changes with the breakpoint. */
  size: number | string;
};

export function LolIcon({ kind, url, name, size }: Props) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  const px = typeof size === "number" ? size : undefined;
  const shape = kind === "rune" || kind === "tree" ? "rounded-full" : "rounded-sm";

  if (url === null || failed) {
    return (
      <span
        role="img"
        aria-label={name}
        aria-hidden={!name}
        title={name}
        style={style}
        className={`flex flex-none items-center justify-center border border-neutral-800 bg-(--gcs-surface-2) text-[8px] font-black text-neutral-500 uppercase ${shape}`}
      >
        {name.slice(0, 1)}
      </span>
    );
  }

  const champion = kind === "champion";
  // A rune tree's emblem fills its image to the edge, so a round crop would cut its tips: it is shown whole, no frame.
  const tree = kind === "tree";
  return (
    <img
      src={url}
      alt={`${name} ${kind} image`}
      title={name}
      loading="lazy"
      width={px}
      height={px}
      style={{...style, clipPath: champion ? "inset(6% round 4px)" : ""}}
      className={champion ? "flex-none object-cover" : tree ? "flex-none object-contain" : `flex-none border border-neutral-800 bg-(--gcs-surface-2) object-cover ${shape}`}
      onError={() => setFailed(true)}
    />
  );
}
