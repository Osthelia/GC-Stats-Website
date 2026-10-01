/**
 * GC-Stats - mention-textarea
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { searchForumMentionUsers } from "@/actions/forum";
import { ForumAvatar } from "@/components/forum/forum-avatar";

export type MentionTextareaHandle = { insertAtCursor: (text: string) => void };

const inputClass =
  "w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid=true]:border-[#e08585]";

type MentionUser = { id: string; username: string | null; image: string | null };

/**
 * Textarea with an inline `@username` mention autocomplete (Discord/GitHub
 * style), shared by the thread create form and the reply form. Emote
 * insertion (EmoteInsertButton) stays external and reaches in via the
 * imperative handle, same trick both forms already used for their own ref.
 */
export const MentionTextarea = forwardRef<MentionTextareaHandle, {
  value: string;
  onChange: (value: string) => void;
  rows: number;
  maxLength: number;
  invalid?: boolean;
}>(function MentionTextarea({ value, onChange, rows, maxLength, invalid }, ref) {
  const t = useTranslations("forum.mention");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tokenStart, setTokenStart] = useState<number | null>(null);
  const [results, setResults] = useState<MentionUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState<string | null>(null);
  const requestId = useRef(0);

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + text.length, start + text.length);
      });
    },
  }));

  useEffect(() => {
    if (query === null) {
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    const timeout = setTimeout(() => {
      searchForumMentionUsers(query).then((rows) => {
        if (id === requestId.current) {
          setResults(rows);
          setActiveIndex(0);
        }
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  function detectMentionToken(text: string, caret: number) {
    const uptoCaret = text.slice(0, caret);
    const match = /(?:^|\s)@([a-zA-Z0-9_-]{0,32})$/.exec(uptoCaret);
    if (!match) {
      setTokenStart(null);
      setQuery(null);
      return;
    }
    setTokenStart(caret - match[1]!.length - 1);
    setQuery(match[1]!);
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    detectMentionToken(e.target.value, e.target.selectionStart);
  }

  function selectUser(username: string) {
    const el = textareaRef.current;
    if (el == null || tokenStart === null) return;
    const caret = el.selectionStart;
    const before = value.slice(0, tokenStart);
    const after = value.slice(caret);
    const insertion = `@${username} `;
    onChange(before + insertion + after);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + insertion.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (query === null || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const target = results[activeIndex];
      if (target?.username) {
        e.preventDefault();
        selectUser(target.username);
      }
    } else if (e.key === "Escape") {
      setQuery(null);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={invalid}
        className={inputClass}
      />
      {query !== null && results.length > 0 && (
        <div
          role="listbox"
          aria-label={t("suggestions")}
          className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-56 w-64 overflow-y-auto rounded-xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-1 shadow-[0_16px_36px_rgba(0,0,0,.6)]"
        >
          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => r.username && selectUser(r.username)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] transition-colors ${
                i === activeIndex ? "bg-neutral-800 text-neutral-50" : "text-neutral-300"
              }`}
            >
              <ForumAvatar username={r.username} image={r.image} size={20} />
              <span className="truncate">{r.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
