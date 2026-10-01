/**
 * GC-Stats - public-tags-input
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";

/** Free-text multi-value tag editor for the public site — mirrors components/admin/tags-input.tsx, restyled to the site's dark tokens instead of shadcn. */
export function PublicTagsInput({
  value,
  onChange,
  placeholder,
  addLabel,
  maxItems,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  addLabel: string;
  maxItems: number;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tag = draft.trim();
    if (!tag || value.includes(tag) || value.length >= maxItems) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          disabled={value.length >= maxItems}
          className="max-w-[220px] flex-1 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={commit}
          disabled={value.length >= maxItems}
          className="rounded-[9px] border border-neutral-700 px-3 py-2 text-[12.5px] font-semibold text-neutral-300 transition-colors hover:border-[#e4ae22]/60 disabled:opacity-50"
        >
          {addLabel}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-white/5 px-2.5 py-1 text-[12px] text-neutral-300">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={tag} className="text-neutral-500 hover:text-neutral-200">
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
