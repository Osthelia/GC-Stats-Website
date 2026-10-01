/**
 * GC-Stats - hidden-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** "Hidden from public" marker on a history entry (team name / logo), same amber accent as the moderation "hidden" status. */
export function HiddenBadge({ children }: { children: ReactNode }) {
  return <Badge variant="outline" className="border-amber-400/20 bg-amber-400/10 text-amber-300">{children}</Badge>;
}
