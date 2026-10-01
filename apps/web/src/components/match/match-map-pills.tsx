/**
 * GC-Stats - match-map-pills
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";

type PillMap = { id: number; mapName: string; teamAScore: number | null; teamBScore: number | null };

const isPlayed = (m: PillMap) => m.teamAScore != null && m.teamBScore != null && !(m.teamAScore === -1 && m.teamBScore === -1);

const ACTIVE_CLASS = "scale-105 bg-[#e4ae22] text-black shadow-[0_0_18px_rgba(228,174,34,0.35)]";
const INACTIVE_CLASS = "bg-white/5 text-neutral-400 hover:-translate-y-0.5 hover:bg-white/10 hover:text-neutral-200 active:translate-y-0 active:scale-95";

/** Map selector pill bar. Switches which map's stats show below, no navigation (mirrors V1). `activeMapId` null means the aggregated "All Maps" tab is active. */
export function MatchMapPills({ maps, bestOf, activeMapId, onSelect }: { maps: PillMap[]; bestOf: number; activeMapId: number | null; onSelect: (mapId: number | null) => void }) {
  const t = useTranslations("matchPage");

  return (
    <div className="mb-10 flex flex-wrap justify-center gap-2.5" role="tablist" aria-label={t("maps")}>
      {bestOf !== 1 && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          role="tab"
          aria-selected={activeMapId == null}
          className={`rounded-full px-7 py-2.5 text-[10px] font-black tracking-widest uppercase transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
            activeMapId == null ? ACTIVE_CLASS : INACTIVE_CLASS
          }`}
        >
          {t("allMaps")}
        </button>
      )}
      {maps.map((m) => {
        const played = isPlayed(m);
        const active = activeMapId === m.id;
        const scoreLabel = played ? `${m.teamAScore === -1 ? "FF" : m.teamAScore}-${m.teamBScore === -1 ? "FF" : m.teamBScore}` : null;
        const className = `group flex items-center rounded-full px-5 py-2.5 text-[10px] font-black tracking-widest uppercase transition-all duration-300 ease-out ${active ? ACTIVE_CLASS : INACTIVE_CLASS}`;

        if (!played) {
          return (
            <span key={m.id} role="tab" aria-disabled aria-selected={false} className={`${className} cursor-not-allowed opacity-40`}>
              {m.mapName}
            </span>
          );
        }

        return (
          <button key={m.id} type="button" onClick={() => onSelect(m.id)} role="tab" aria-selected={active} className={className}>
            {m.mapName}
            {scoreLabel && <span className={`ml-2.5 rounded-full px-2 py-0.5 font-mono text-[9px] transition-colors ${active ? "bg-black/15" : "bg-black/30 group-hover:bg-black/50"}`}>{scoreLabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
