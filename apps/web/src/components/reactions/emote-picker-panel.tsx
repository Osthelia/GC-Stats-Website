/**
 * GC-Stats - emote-picker-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { EmoteImage } from "@/components/reactions/emote-image";
import type { PickerEmote } from "@/lib/reactions";

const VISIBLE_LIMIT = 30;

/**
 * Search and capped grid over the active emote list, never renders the whole
 * catalog at once, search narrows it down instead. Shared by the reaction
 * picker (components/reactions/reaction-bar.tsx) and the forum post
 * emote-insert button (components/forum/emote-insert-button.tsx).
 */
export function EmotePickerPanel({ emotes, onSelect }: { emotes: PickerEmote[]; onSelect: (emote: PickerEmote) => void }) {
  const t = useTranslations("forum.reactions");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? emotes.filter((e) => e.name.toLowerCase().includes(q)) : emotes;
  }, [emotes, query]);

  const visible = filtered.slice(0, VISIBLE_LIMIT);
  const truncated = filtered.length > VISIBLE_LIMIT;

  if (emotes.length === 0) {
    return <p className="px-1 py-2 text-[12px] text-neutral-500">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="w-full rounded-lg border border-neutral-700 bg-[var(--gcs-surface-2)] px-2.5 py-1.5 text-[12.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60"
      />

      {visible.length === 0 ? (
        <p className="px-1 py-2 text-[12px] text-neutral-500">{t("noResults")}</p>
      ) : (
        <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
          {visible.map((emote) => (
            <button
              key={emote.id}
              type="button"
              title={emote.name}
              aria-label={emote.name}
              onClick={() => onSelect(emote)}
              className="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            >
              <EmoteImage src={emote.imagePath} alt={emote.name} className="size-6 rounded-sm object-contain" />
            </button>
          ))}
        </div>
      )}

      {truncated && <p className="px-1 text-[11px] text-neutral-600">{t("searchHint")}</p>}
    </div>
  );
}
