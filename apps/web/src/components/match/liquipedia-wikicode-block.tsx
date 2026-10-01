/**
 * GC-Stats - liquipedia-wikicode-block
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/** Copies `text` to the clipboard, with a short "Copied" state as feedback. */
function LiquipediaCopyButton({ text, label }: { text: string; label?: string }) {
  const t = useTranslations("matchLiquipedia");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error(t("copyError"));
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-[9px] bg-[#e4ae22] px-4 py-2 text-[10px] font-black tracking-wider text-[#0e0e0e] uppercase transition-opacity hover:opacity-90 active:scale-95"
    >
      {copied ? t("copied") : (label ?? t("copy"))}
    </button>
  );
}

/** Wikicode with a copy button; `header` replaces the default "Wikicode" caption. */
export function LiquipediaWikicodeBlock({ wikicode, header }: { wikicode: string; header?: ReactNode }) {
  const t = useTranslations("matchLiquipedia");
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        {header ?? <span className="font-mono text-[10px] font-black tracking-[0.3em] text-neutral-500 uppercase">{t("wikicode")}</span>}
        <LiquipediaCopyButton text={wikicode} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-neutral-300 select-all">{wikicode}</pre>
    </div>
  );
}
