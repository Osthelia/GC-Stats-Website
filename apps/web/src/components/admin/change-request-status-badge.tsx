/**
 * GC-Stats - change-request-status-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChangeRequestStatus } from "@/lib/admin-change-requests";

const STYLES: Record<ChangeRequestStatus, string> = {
  pending: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  approved: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  partial: "bg-sky-400/10 text-sky-300 border-sky-400/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
};

const LABEL_KEYS: Record<ChangeRequestStatus, "statusPending" | "statusApproved" | "statusRejected" | "statusPartial" | "statusWithdrawn"> = {
  pending: "statusPending",
  approved: "statusApproved",
  rejected: "statusRejected",
  partial: "statusPartial",
  withdrawn: "statusWithdrawn",
};

export function ChangeRequestStatusBadge({ status }: { status: ChangeRequestStatus }) {
  const t = useTranslations("admin.changeRequests");
  const label = t(LABEL_KEYS[status]);
  return (
    <Badge variant="outline" className={cn(STYLES[status])}>
      {label}
    </Badge>
  );
}
