/**
 * GC-Stats - active-status-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES = {
  active: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  inactive: "bg-muted text-muted-foreground border-border",
} as const;

/** Shared colored active/inactive badge, same palette as the moderation status badges. */
export function ActiveStatusBadge({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: ReactNode; inactiveLabel: ReactNode }) {
  return <Badge variant="outline" className={cn(active ? STYLES.active : STYLES.inactive)}>{active ? activeLabel : inactiveLabel}</Badge>;
}
