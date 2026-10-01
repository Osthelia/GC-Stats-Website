/**
 * GC-Stats - list-pagination
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";

/** Shared prev/next pagination for public list pages (search, tournaments, ...). */
export function ListPagination({
  page,
  totalPages,
  prevHref,
  nextHref,
  previousLabel,
  nextLabel,
  pageOfLabel,
}: {
  page: number;
  totalPages: number;
  prevHref: string;
  nextHref: string;
  previousLabel: string;
  nextLabel: string;
  pageOfLabel: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <Link
        href={prevHref}
        aria-disabled={page <= 1}
        className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface)] px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-[var(--gcs-hover)] aria-disabled:pointer-events-none aria-disabled:opacity-40"
      >
        {previousLabel}
      </Link>
      <span className="text-xs text-[var(--gcs-text-tertiary)]">{pageOfLabel}</span>
      <Link
        href={nextHref}
        aria-disabled={page >= totalPages}
        className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface)] px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-[var(--gcs-hover)] aria-disabled:pointer-events-none aria-disabled:opacity-40"
      >
        {nextLabel}
      </Link>
    </div>
  );
}
