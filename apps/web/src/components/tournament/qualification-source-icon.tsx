/**
 * GC-Stats - qualification-source-icon
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QualificationSourceLabel } from "@/components/tournament/qualification-source-label";
import type { EntrantQualificationSource } from "@/lib/entrant-qualification-source";

/** Discreet icon, the qualification source shows on hover or focus. */
export function QualificationSourceIcon({ source }: { source: EntrantQualificationSource }) {
  const t = useTranslations("qualificationSource");
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={t("iconLabel")}
        className="shrink-0 rounded text-neutral-400 transition-colors hover:text-[#e4ae22] focus-visible:text-[#e4ae22] focus-visible:outline-none active:scale-90"
      >
        <InfoIcon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>
        <QualificationSourceLabel source={source} plain />
      </TooltipContent>
    </Tooltip>
  );
}
