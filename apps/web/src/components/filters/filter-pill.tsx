/**
 * GC-Stats - filter-pill
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";

/**
 * Shared pill filter/sort control for public list pages (search results,
 * tournaments, and any future teams/players list) — one implementation
 * instead of a slightly-different one per page, per CLAUDE.md.
 */
export function FilterPill({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? "border-[#e4ae22] bg-[#e4ae22] text-[#0e0e0e]" : "border-neutral-800 bg-[var(--gcs-surface)] text-[var(--gcs-text-dim)] hover:bg-[var(--gcs-hover)] hover:text-[var(--gcs-text)]"
      }`}
    >
      {label} {count !== undefined && <span className="opacity-70">{count}</span>}
    </Link>
  );
}

export function SortPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-[var(--gcs-hover-2)] text-[#e4ae22]" : "text-[var(--gcs-text-dim)] hover:bg-[var(--gcs-hover)] hover:text-[var(--gcs-text)]"
      }`}
    >
      {label}
    </Link>
  );
}
