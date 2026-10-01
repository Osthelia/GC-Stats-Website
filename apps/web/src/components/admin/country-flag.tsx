/**
 * GC-Stats - country-flag
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { GlobeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryFlagClass } from "@/lib/countries";

/**
 * flag-icons sprite for a country, falling back to a generic globe
 * (International / unset). When `secondaryCode` is a second, distinct
 * country, both flags are fused into one swatch — primary top-left,
 * secondary bottom-right, split diagonally — rather than showing two
 * separate flag icons side by side (dual nationality, not two entities).
 */
export function CountryFlag({ code, secondaryCode, className }: { code: string | null; secondaryCode?: string | null; className?: string }) {
  const flagClass = countryFlagClass(code);
  const secondaryFlagClass = secondaryCode && secondaryCode !== code ? countryFlagClass(secondaryCode) : null;

  if (!flagClass) return <GlobeIcon className={cn("text-muted-foreground", className)} />;

  if (!secondaryFlagClass) {
    return <span className={cn("fi shrink-0 rounded-[2px]", flagClass, className)} />;
  }

  // flag-icons' own .fi rule (width/line-height/position) ships as plain,
  // un-layered CSS — under Tailwind v4's cascade layers that beats any
  // `@layer utilities` class of equal specificity regardless of import
  // order, so absolute/inset/size have to be forced via `style` (inline
  // styles always win over stylesheet rules here), not a class.
  return (
    <span className={cn("relative inline-block shrink-0 overflow-hidden rounded-[2px]", className)}>
      <span className={cn("fi", flagClass)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
      <span className={cn("fi", secondaryFlagClass)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />
    </span>
  );
}
