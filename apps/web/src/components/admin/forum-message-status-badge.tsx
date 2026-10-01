/**
 * GC-Stats - forum-message-status-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ForumMessageStatus } from "@/lib/admin-forum-messages";

const STYLES: Record<ForumMessageStatus, string> = {
  visible: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  hidden: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  deleted: "bg-destructive/10 text-destructive border-destructive/20",
};

export function ForumMessageStatusBadge({ status }: { status: ForumMessageStatus }) {
  const t = useTranslations("admin.forum");
  return <Badge variant="outline" className={cn(STYLES[status])}>{t(`status.${status}`)}</Badge>;
}
