/**
 * GC-Stats - liquipedia-link-pill
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { LiquipediaIcon } from "@/components/icons/brand-icons";

// Liquipedia's own favicon, same URL V1 hardcoded in its tournament/team/
// player headers — real brand mark instead of our generic outline glyph
// (explicit user direction: "on met le logo Liquipedia, voir V1"). Falls
// back to that outline glyph on load failure (CLAUDE.md: every logo needs a
// fallback), same pattern as AgentIcon.
const LIQUIPEDIA_LOGO_URL = "https://liquipedia.net/commons/extensions/TeamLiquidIntegration/resources/pagelogo/liquipedia_icon_menu.png";

export function LiquipediaLinkPill({ href, label }: { href: string; label: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5c4c22] hover:text-[#e4ae22] active:scale-[0.97]"
    >
      {failed ? <LiquipediaIcon className="h-3.5 w-3.5" /> : <img src={LIQUIPEDIA_LOGO_URL} alt="" className="h-3.5 w-3.5 object-contain" onError={() => setFailed(true)} />}
      {label}
    </a>
  );
}
