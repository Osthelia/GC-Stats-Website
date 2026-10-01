/**
 * GC-Stats - sanction-type-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SanctionType } from "@/lib/admin-sanctions";

const STYLES: Record<SanctionType, string> = {
  note: "bg-sky-400/10 text-sky-300 border-sky-400/20",
  warning: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  mute: "bg-violet-400/10 text-violet-300 border-violet-400/20",
  suspension: "bg-orange-400/10 text-orange-300 border-orange-400/20",
  ban: "bg-destructive/10 text-destructive border-destructive/20",
};

export function SanctionTypeBadge({ type }: { type: SanctionType }) {
  const t = useTranslations("admin.sanctions");
  return <Badge variant="outline" className={cn(STYLES[type])}>{t(`type.${type}`)}</Badge>;
}
