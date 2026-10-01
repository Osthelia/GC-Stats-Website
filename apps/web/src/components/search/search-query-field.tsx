/**
 * GC-Stats - search-query-field
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useRef, useState } from "react";

/** /search query input: decorative magnifier on the left, a clear button once something is typed (Enter submits). */
export function SearchQueryField({
  name,
  defaultValue,
  placeholder,
  clearLabel,
}: {
  name: string;
  defaultValue: string;
  placeholder: string;
  clearLabel: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--gcs-text-tertiary)"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="flex-none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.6-3.6" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-sm text-neutral-50 outline-none placeholder:text-[var(--gcs-text-tertiary)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-[var(--gcs-text-tertiary)] transition-colors hover:bg-[var(--gcs-hover)] hover:text-neutral-50 active:scale-95"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </>
  );
}
