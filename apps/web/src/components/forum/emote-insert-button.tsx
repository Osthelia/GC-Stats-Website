/**
 * GC-Stats - emote-insert-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SmilePlus } from "lucide-react";
import { EmotePickerPanel } from "@/components/reactions/emote-picker-panel";
import type { PickerEmote } from "@/lib/reactions";

/** Lets a forum post author insert an emote shortcode (`:name:`) into the message body — rendered back as an image by components/forum/forum-message-body.tsx. */
export function EmoteInsertButton({ emotes, onInsert }: { emotes: PickerEmote[]; onInsert: (name: string) => void }) {
  const t = useTranslations("forum.reactions");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (emotes.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("insertEmote")}
        className="flex size-7 items-center justify-center rounded-full border border-neutral-800 bg-[var(--gcs-surface-2)] text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200"
      >
        <SmilePlus className="size-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("pickerTitle")}
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 rounded-xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-2 shadow-[0_16px_36px_rgba(0,0,0,.6)]"
        >
          <EmotePickerPanel
            emotes={emotes}
            onSelect={(emote) => {
              onInsert(emote.name);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
