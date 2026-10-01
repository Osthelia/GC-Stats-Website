/**
 * GC-Stats - admin-info-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small inline notice for admin panels — "not built yet" / "heads up" banners. Not the public-site `components/legal/ui.tsx` InfoBar (different design system, cf. CLAUDE.md admin/site component split). */
export function AdminInfoBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400", className)}>
      <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
