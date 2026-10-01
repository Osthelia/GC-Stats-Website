/**
 * GC-Stats - admin-panel-link
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V6l8-3z" />
    </svg>
  );
}

/**
 * Public-site "Admin panel" shortcut (mirrors V1) — shown only to viewers
 * with admin.access, jumping straight to the matching admin show/edit page.
 * Lives in HeaderUtilityBar, top-right of the entity header card.
 */
export function AdminPanelLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-lg border border-[#5c4c22] bg-[#e4ae22]/10 px-2.5 py-1.5 text-xs font-semibold text-[#e4ae22] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e4ae22]/20 active:scale-[0.97]"
    >
      <ShieldIcon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
