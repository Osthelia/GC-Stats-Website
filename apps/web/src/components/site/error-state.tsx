/**
 * GC-Stats - error-state
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { GcStatsWordmark } from "@/components/site/gc-stats-wordmark";
import { cn } from "@/lib/utils";

/**
 * Shared layout for not-found/error/forbidden/unauthorized pages. `compact`
 * drops the wordmark for use inside a shell that already shows branding
 * (admin/dashboard sidebar layouts).
 */
export function ErrorState({
  code,
  icon,
  title,
  body,
  primaryAction,
  secondaryAction,
  compact = false,
}: {
  code: string;
  icon: ReactNode;
  title: string;
  body: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-20 text-center",
        compact ? "min-h-[50vh]" : "min-h-[70vh]"
      )}
    >
      {!compact && (
        <Link href="/" className="mb-10 text-lg font-bold tracking-tight text-neutral-50">
          <GcStatsWordmark />
        </Link>
      )}
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-neutral-900 text-neutral-400">
        {icon}
      </div>
      <p className="mb-2 font-mono text-xs font-medium tracking-widest text-neutral-600">{code}</p>
      <h1 className="mb-2 text-[26px] font-bold tracking-tight text-neutral-50">{title}</h1>
      <p className="mb-8 max-w-md text-[15px] leading-[1.6] text-neutral-400">{body}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryAction}
        {secondaryAction}
      </div>
    </div>
  );
}
