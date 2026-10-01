/**
 * GC-Stats - field-chip
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Popover } from "@base-ui/react/popover";

/** A single field name, its description opens on hover, focus or tap, kept inside the viewport (flip + shift). */
export function FieldChip({
  name,
  description,
  accent = false,
}: {
  name: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={80}
        className={`cursor-help rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide outline-none transition-colors select-none active:scale-95 ${
          accent
            ? "border-[#e4ae22]/50 text-[#e4ae22] hover:bg-[#e4ae22]/10 focus-visible:bg-[#e4ae22]/10 data-[popup-open]:bg-[#e4ae22]/10"
            : "border-neutral-800 text-neutral-500 hover:border-[#e4ae22] hover:text-neutral-50 focus-visible:border-[#e4ae22] focus-visible:text-neutral-50 data-[popup-open]:border-[#e4ae22] data-[popup-open]:text-neutral-50"
        }`}
      >
        {name}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[80]"
        >
          <Popover.Popup className="w-56 max-w-[calc(100vw-24px)] rounded-lg border border-neutral-800 bg-black/95 p-2.5 shadow-2xl transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <p className="text-[11px] leading-snug font-semibold text-neutral-300">
              {description}
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
