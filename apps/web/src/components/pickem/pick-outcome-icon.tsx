/**
 * GC-Stats - pick-outcome-icon
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { RED } from "@/lib/theme-colors";

export type PickOutcome = "correct" | "wrong" | "pending";

// Same green as the bracket's winner edges.
export const OUTCOME_COLORS = { correct: "#3fb950", wrong: RED } as const;

/** Right/wrong marker of a locked pick, nothing while the result isn't known. */
export function PickOutcomeIcon({ outcome, className = "h-3.5 w-3.5" }: { outcome: PickOutcome; className?: string }) {
  const t = useTranslations("pickemPage");
  if (outcome === "pending") return null;
  const Icon = outcome === "correct" ? Check : X;
  const label = t(outcome === "correct" ? "pickCorrect" : "pickWrong");
  return (
    <span role="img" aria-label={label} title={label} className="flex flex-none">
      <Icon className={className} strokeWidth={3} style={{ color: OUTCOME_COLORS[outcome] }} />
    </span>
  );
}
