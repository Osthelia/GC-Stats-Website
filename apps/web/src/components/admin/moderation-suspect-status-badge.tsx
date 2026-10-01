/**
 * GC-Stats - moderation-suspect-status-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModerationSuspectStatus } from "@/lib/admin-moderation-suspects";

const STYLES: Record<ModerationSuspectStatus, string> = {
  pending: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  actioned: "bg-destructive/10 text-destructive border-destructive/20",
  dismissed: "bg-muted text-muted-foreground border-border",
};

export function ModerationSuspectStatusBadge({ status }: { status: ModerationSuspectStatus }) {
  const t = useTranslations("admin.moderation");
  return <Badge variant="outline" className={cn(STYLES[status])}>{t(`status.${status}`)}</Badge>;
}
