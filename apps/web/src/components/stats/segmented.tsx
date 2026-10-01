/**
 * GC-Stats - segmented
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";
import { GOLD } from "@/lib/home-fake-data";

// One consistent segmented-control shell for the stats pages' period picker
// (href-based, server nav) and avg/total toggle (client state) — same DA
// language as `PlayerHeader`/`TeamHeader`'s tab bar (solid gold pill for the
// active segment, no per-segment border) instead of nesting a rounded-full
// `FilterPill` inside a track, which read as two clashing shapes.

// Scrolls horizontally when the segments don't fit (10 maps on a phone).
export function SegmentedTrack({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-fit max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

const SEGMENT_CLASS =
  "flex-none whitespace-nowrap rounded-md px-3 py-1.5 text-[11.5px] transition-all duration-200 active:scale-[0.96]";

export function SegmentedLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={SEGMENT_CLASS}
      style={
        active
          ? { background: GOLD, color: "#0b0b0c", fontWeight: 700 }
          : { color: "var(--gcs-text-secondary)", fontWeight: 600 }
      }
    >
      {children}
    </Link>
  );
}

export function SegmentedButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${SEGMENT_CLASS} ${active ? "" : "hover:-translate-y-0.5 hover:bg-white/5"}`}
      style={
        active
          ? { background: GOLD, color: "#0b0b0c", fontWeight: 700 }
          : { color: "var(--gcs-text-secondary)", fontWeight: 600 }
      }
    >
      {children}
    </button>
  );
}
