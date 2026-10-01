/**
 * GC-Stats - ghost-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

/** Marks a ghost team, player or tournament in admin lists: only visible on its matches publicly. */
export function GhostBadge() {
  const t = useTranslations("admin.ghost");
  return (
    <Badge variant="outline" className="border-violet-400/20 bg-violet-400/10 text-violet-300" title={t("badgeHint")}>
      {t("badge")}
    </Badge>
  );
}
