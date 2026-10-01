/**
 * GC-Stats - report-status-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReportStatus } from "@/lib/admin-reports";

const STYLES: Record<ReportStatus, string> = {
  pending: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  resolved: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  dismissed: "bg-muted text-muted-foreground border-border",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const t = useTranslations("admin.reports");
  return <Badge variant="outline" className={cn(STYLES[status])}>{t(`status.${status}`)}</Badge>;
}
