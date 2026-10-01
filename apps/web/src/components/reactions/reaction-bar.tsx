/**
 * GC-Stats - reaction-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SmilePlus } from "lucide-react";
import { toggleReaction } from "@/actions/reactions";
import { EmoteImage } from "@/components/reactions/emote-image";
import { EmotePickerPanel } from "@/components/reactions/emote-picker-panel";
import type { ReactableType, ReactionSummary, PickerEmote } from "@/lib/reactions";

/**
 * Generic reaction bar over the polymorphic `reactions` table (see
 * lib/reactions.ts). Forum messages are the only consumer today, but
 * reactableType/reactableId make it a drop-in for news/matches/tournaments
 * later without a rewrite, one reusable component, not a new system per
 * domain.
 */
export function ReactionBar({
  reactableType,
  reactableId,
  initialReactions,
  pickerEmotes,
  isAuthenticated,
}: {
  reactableType: ReactableType;
  reactableId: number;
  initialReactions: ReactionSummary[];
  pickerEmotes: PickerEmote[];
  isAuthenticated: boolean;
}) {
  const t = useTranslations("forum.reactions");
  const [reactions, setReactions] = useState(initialReactions);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setPickerOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  function react(emoteId: number) {
    setError(null);
    setPickerOpen(false);
    startTransition(async () => {
      const result = await toggleReaction({ reactableType, reactableId, emoteId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReactions(result.reactions);
    });
  }

  return (
    <div ref={rootRef} className="relative mt-2 flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoteId}
          type="button"
          disabled={!isAuthenticated || isPending}
          onClick={() => react(r.emoteId)}
          aria-label={r.emoteName}
          title={r.emoteName}
          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[12px] transition-colors ${
            r.reactedByMe ? "border-[#e4ae22]/70 bg-[#e4ae22]/10 text-[#e4ae22]" : "border-neutral-800 bg-[var(--gcs-surface-2)] text-neutral-400 hover:border-neutral-700"
          } disabled:cursor-not-allowed disabled:opacity-70`}
        >
          <EmoteImage src={r.emoteImagePath} alt={r.emoteName} className="size-4 rounded-sm object-contain" />
          <span>{r.count}</span>
        </button>
      ))}

      {isAuthenticated && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setPickerOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          aria-label={t("add")}
          title={t("add")}
          className="flex size-6 items-center justify-center rounded-full border border-neutral-800 bg-[var(--gcs-surface-2)] text-neutral-500 transition-colors hover:border-neutral-700 hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <SmilePlus className="size-3.5" />
        </button>
      )}

      {pickerOpen && (
        <div
          role="menu"
          aria-label={t("pickerTitle")}
          className="absolute bottom-[calc(100%+6px)] left-0 z-30 w-64 rounded-xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-2 shadow-[0_16px_36px_rgba(0,0,0,.6)]"
        >
          <EmotePickerPanel emotes={pickerEmotes} onSelect={(emote) => react(emote.id)} />
        </div>
      )}

      {error && <p className="w-full text-[11.5px] text-[#e08585]">{t(`error.${error}`)}</p>}
    </div>
  );
}
