/**
 * GC-Stats - entity-tab-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { GOLD } from "@/lib/theme-colors";

const FADE = "28px";

/**
 * Tab bar of the team/player/tournament/organization headers: scrolls sideways on narrow screens, fades the clipped edge and brings the active tab into view.
 * Without `activeKey`, the active tab is the URL segment below the calling layout (the first tab on the layout's own page).
 */
export function EntityTabBar({
  tabs: allTabs,
  activeKey: activeKeyProp,
}: {
  /** `hideUnlessActive`: only shown while it's the open tab. */
  tabs: { key: string; href: string; label: string; hideUnlessActive?: boolean }[];
  activeKey?: string;
}) {
  const segment = useSelectedLayoutSegment();
  const activeKey = activeKeyProp ?? segment ?? allTabs[0]?.key ?? "";
  const tabs = allTabs.filter((tab) => tab.key === activeKey || !tab.hideUnlessActive);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    const active = activeRef.current;
    if (active && el.scrollWidth > el.clientWidth) {
      el.scrollLeft =
        active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [activeKey]);

  const mask = `linear-gradient(to right, ${edges.left ? "transparent" : "#000"}, #000 ${FADE}, #000 calc(100% - ${FADE}), ${edges.right ? "transparent" : "#000"})`;

  return (
    <div
      ref={scrollerRef}
      className="flex items-end gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {tabs.map((tab) => {
        const on = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            ref={on ? activeRef : undefined}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`flex-none whitespace-nowrap rounded-t-lg px-4 py-2.5 text-[13.5px] transition-all duration-200 active:opacity-70 ${on ? "" : "hover:-translate-y-0.5 hover:bg-white/5"}`}
            style={
              on
                ? { background: GOLD, color: "#0b0b0c", fontWeight: 700 }
                : { color: "var(--gcs-text-secondary)", fontWeight: 600 }
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
