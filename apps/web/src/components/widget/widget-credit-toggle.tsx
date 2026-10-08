/**
 * GC-Stats - widget-credit-toggle
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

/** Opt-in switch for the "Widget provided by GC Stats" credit, shared by every widget builder. */
export function WidgetCreditToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const t = useTranslations("widget.builder");

  return (
    <div>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex w-full items-center gap-3 rounded-[9px] border px-3 py-2.5 text-left text-[13px] font-medium transition-colors active:scale-[0.99] ${
          checked ? "border-[#e4ae22] bg-[#e4ae22]/10 text-neutral-50" : "border-neutral-700 bg-[var(--gcs-surface-2)] text-neutral-400 hover:bg-white/5"
        }`}
      >
        <span className={`flex size-4 flex-none items-center justify-center rounded border ${checked ? "border-[#e4ae22] bg-[#e4ae22] text-[#0e0e0e]" : "border-neutral-600"}`}>
          {checked && <Check className="size-3" strokeWidth={3} />}
        </span>
        {t("credit")}
      </button>
      <p className="mt-1.5 text-[10px] text-neutral-500">{t("creditHint")}</p>
    </div>
  );
}
