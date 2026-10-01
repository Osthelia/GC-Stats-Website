/**
 * GC-Stats - admin-stat-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COLOR_STYLES = {
  amber: "bg-amber-400/10 text-amber-400",
  emerald: "bg-emerald-400/10 text-emerald-400",
  destructive: "bg-destructive/10 text-destructive",
  sky: "bg-sky-400/10 text-sky-400",
  violet: "bg-violet-400/10 text-violet-400",
  orange: "bg-orange-400/10 text-orange-400",
  muted: "bg-muted text-muted-foreground",
} as const;

/**
 * Small colored count tile, shared by every admin list page that benefits from an
 * at-a-glance breakdown (moderation group, change requests, dashboard overview).
 */
export function AdminStatCard({ label, value, icon: Icon, color }: { label: string; value: ReactNode; icon: ComponentType<{ className?: string }>; color: keyof typeof COLOR_STYLES }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-1">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", COLOR_STYLES[color])}>
          <Icon className="size-4.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
