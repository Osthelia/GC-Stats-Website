/**
 * GC-Stats - sort-link
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";

/** Sortable column header for public paginated lists — hrefs built server-side by the caller (lib/production-list-params.ts), same "no client state" pattern as ListPagination/ListFilterDropdown. */
export function SortLink({ label, href, active, direction }: { label: string; href: string; active: boolean; direction: "asc" | "desc" }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 font-mono text-[10px] font-black tracking-[0.12em] uppercase transition-colors ${active ? "text-[#e4ae22]" : "text-neutral-500 hover:text-neutral-300"}`}
    >
      {label}
      {active && <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span>}
    </Link>
  );
}
