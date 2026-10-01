/**
 * GC-Stats - admin-public-link-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ExternalLinkIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Small pill button, top-right of the page — mirrors V1's admin detail
 * pages (tournament/match show.blade.php): a compact "view public page"
 * link next to the back link, not mixed into the action button stack.
 */
export function AdminPublicLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
    >
      <ExternalLinkIcon className="size-3.5" />
      {label}
    </Link>
  );
}
