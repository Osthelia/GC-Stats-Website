/**
 * GC-Stats - use-anchor-rect
 *
 * Hook tracking an anchor element's viewport rect, for portaling dropdowns
 * to document.body instead of rendering them inline.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export type AnchorRect = { top: number; left: number; width: number; bottom: number };

/**
 * Tracks an anchor element's viewport position while `open` — used to
 * portal a dropdown to `document.body` with `position: fixed` instead of
 * rendering it inline. A hand-rolled `position: absolute` dropdown that
 * stays inside its row's DOM subtree can visually shove that row around the
 * moment it opens (e.g. inside a CSS grid row with `items-end`/`items-start`
 * sizing); portaling out to body sidesteps that class of layout bug
 * entirely, the same way the shadcn Select in this app already does via
 * base-ui's own Portal.
 */
export function useAnchorRect(open: boolean, anchorRef: RefObject<HTMLElement | null>): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });
    };
    update();

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  return rect;
}
