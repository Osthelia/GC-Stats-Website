/**
 * GC-Stats - field-dictionary
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";

export { FieldChip } from "@/components/data/field-chip";

/** Optional sub-label ("Main information", "Confidential", ...) above a wrap of chips. */
export function FieldGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-[9px] font-black tracking-wide text-neutral-500 uppercase italic">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Numbered card for one table/entity. */
export function TableCard({
  index,
  title,
  children,
  className = "",
}: {
  index?: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6 shadow-xl ${className}`}
    >
      <h3 className="mb-4 flex items-center gap-2 border-b border-neutral-800 pb-3 text-xs font-bold tracking-widest text-neutral-50 uppercase">
        {index && <span className="text-[#e4ae22]">{index}</span>}
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Highlighted card for a join/link table between two entities. */
export function LinkCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-center gap-5 rounded-2xl border border-[#e4ae22]/30 bg-[var(--gcs-bg)] p-6 shadow-xl">
      <div className="flex w-full items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e4ae22]" />
        <span className="rounded-md border border-[#e4ae22] px-3 py-1 text-[10px] font-black tracking-wide text-[#e4ae22] uppercase">
          {label}
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e4ae22]" />
      </div>
      {children}
    </div>
  );
}

/** Centered uppercase macro-section label, mirrors the V1 dictionary's section dividers. */
export function GroupDivider({ label }: { label: string }) {
  return (
    <div className="border-b border-neutral-800 pt-14 pb-6 text-center first:pt-0">
      <p className="text-[10px] font-bold tracking-[0.4em] text-neutral-500 uppercase">
        {label}
      </p>
    </div>
  );
}

/** Renders a translated description whose source string uses "\n" for line breaks (not raw HTML). */
export function DataCallout({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border-l-2 border-[#e4ae22] bg-black/25 p-5">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#e4ae22"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 flex-none"
      >
        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="space-y-2 text-[13px] leading-relaxed text-neutral-400">
        {text.split("\n").map((line, i) => (
          <p key={i}>{line || " "}</p>
        ))}
      </div>
    </div>
  );
}
