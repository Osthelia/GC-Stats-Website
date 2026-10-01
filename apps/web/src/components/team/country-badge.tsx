/**
 * GC-Stats - country-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { countryFlagClass } from "@/lib/countries";

/** Whether `CountryBadge` would actually render a flag for this code — use to decide whether to render the badge's wrapper at all (no empty box, no globe placeholder). */
export function hasCountryFlag(code: string | null | undefined): boolean {
  return countryFlagClass(code ?? null) !== null;
}

/**
 * flag-icons sprite(s) for a country — public-site counterpart of
 * components/admin/country-flag.tsx, kept separate per the admin/public
 * component split (CLAUDE.md). Dual nationality renders as two flags side
 * by side (a diagonal single-swatch fusion was tried first but read as a
 * rendering glitch, not a flag). No country (or a code that doesn't resolve
 * to a real flag, e.g. "international") renders nothing — no globe
 * placeholder, per explicit user request.
 */
export function CountryBadge({
  code,
  secondaryCode,
  className,
  size = 16,
  label,
}: {
  code: string | null;
  secondaryCode?: string | null;
  className?: string;
  /** Flag width in px — height follows the standard 16:11 flag-icons ratio. */
  size?: number;
  /** Country name(s) for screen readers, e.g. `countryNames(code, secondaryCode, locale)` (omit only when the flag is purely decorative next to visible country text). */
  label?: string | null;
}) {
  const flagClass = countryFlagClass(code);
  const secondaryFlagClass = secondaryCode && secondaryCode !== code ? countryFlagClass(secondaryCode) : null;

  if (!flagClass) return null;

  // flag-icons' own .fi rule (width/line-height/position) ships as plain,
  // un-layered CSS — under Tailwind v4's cascade layers that beats any
  // `@layer utilities` class of equal specificity regardless of import
  // order, so the intended box size has to be forced via `style` (inline
  // styles always win over stylesheet rules here), not a class.
  const flag = (cls: string, key: string, a11yProps?: { role: "img"; "aria-label": string }) => (
    <span key={key} className={`fi ${cls} ${className ?? "shrink-0 rounded-[2px]"}`} style={{ width: size, height: (size * 11) / 16 }} {...a11yProps} />
  );

  const a11yProps = label ? ({ role: "img" as const, "aria-label": label }) : undefined;

  if (!secondaryFlagClass) return flag(flagClass, "primary", a11yProps);

  return (
    <span className="inline-flex shrink-0 items-center gap-1" {...a11yProps}>
      {flag(flagClass, "primary")}
      {flag(secondaryFlagClass, "secondary")}
    </span>
  );
}
