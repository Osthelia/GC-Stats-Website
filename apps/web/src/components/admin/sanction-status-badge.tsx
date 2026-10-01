/**
 * GC-Stats - sanction-status-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SanctionStatus } from "@/lib/admin-sanctions";

const STYLES: Record<SanctionStatus, string> = {
  active: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  expired: "bg-muted text-muted-foreground border-border",
  revoked: "bg-sky-400/10 text-sky-300 border-sky-400/20",
};

export function SanctionStatusBadge({ status }: { status: SanctionStatus }) {
  const t = useTranslations("admin.sanctions");
  return <Badge variant="outline" className={cn(STYLES[status])}>{t(`status.${status}`)}</Badge>;
}
