/**
 * GC-Stats - liquipedia-bracket-template
 *
 * Liquipedia template of one of our brackets, with the link to the generator
 * that builds its wikicode.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "lucide-react";
import { LiquipediaWikicodeBlock } from "@/components/match/liquipedia-wikicode-block";

export function LiquipediaBracketTemplate({ template, generatorUrl }: { template: string; generatorUrl: string }) {
  const t = useTranslations("matchLiquipedia");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-xs text-neutral-500">{t("bracketHint")}</p>
      <LiquipediaWikicodeBlock
        wikicode={template}
        header={<span className="font-mono text-[10px] font-black tracking-[0.3em] text-neutral-500 uppercase">{t("bracketTemplate")}</span>}
      />
      <a
        href={generatorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-[9px] border border-neutral-700 px-4 py-2 text-xs font-bold text-neutral-200 transition-all hover:border-[#e4ae22]/50 hover:text-[#e4ae22] active:scale-95"
      >
        {t("bracketGenerator")}
        <ExternalLinkIcon className="size-3.5" />
      </a>
    </div>
  );
}
