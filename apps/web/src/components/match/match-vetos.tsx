/**
 * GC-Stats - match-vetos
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import type { MatchVetoStep } from "@/lib/match-page-data";

export async function MatchVetos({ steps, teamATag, teamBTag }: { steps: MatchVetoStep[]; teamATag: string; teamBTag: string }) {
  const t = await getTranslations("matchPage");

  return (
    <div className="mt-10 -mx-4 md:-mx-6">
      <div className="mb-8 flex items-center justify-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-neutral-800" />
        <span className="font-mono text-[9px] font-black tracking-[0.5em] text-neutral-600 uppercase">{t("veto")}</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-neutral-800" />
      </div>

      <div className="flex flex-wrap justify-center gap-x-12 gap-y-8 px-6">
        {steps.length === 0 ? (
          <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-700 uppercase italic">{t("noVeto")}</span>
        ) : (
          steps.map((s) => {
            const isBan = s.type === "ban";
            const isDecider = s.type === "decider";
            const colorClass = isBan ? "text-[#f2555a] border-[#f2555a]/40" : isDecider ? "text-[#7fa8ff] border-[#7fa8ff]/40" : "text-[#4ade80] border-[#4ade80]/40";
            const tag = s.isTeamA ? teamATag : teamBTag;
            const sideTag = s.sidePickedByIsTeamA ? teamATag : teamBTag;

            return (
              <div key={s.order} className="flex flex-col items-center">
                <div className="mb-4">
                  <span className={`border-b-2 px-2 py-1 font-mono text-[9px] font-black tracking-[0.2em] uppercase ${colorClass}`}>
                    {isBan ? t("vetoBan") : isDecider ? t("vetoDecider") : t("vetoPick")}
                  </span>
                </div>

                <span className={`mb-2 font-mono text-[9px] font-black tracking-tight text-neutral-500 uppercase ${isDecider ? "invisible" : ""}`}>{tag.slice(0, 6)}</span>

                <div className="flex flex-col items-center">
                  <span className="mb-1 text-xs font-black tracking-[0.1em] text-[var(--gcs-text)] uppercase italic">{s.mapName}</span>

                  {(s.type === "pick" || isDecider) && s.side && (
                    <>
                      <span className="font-mono text-[8px] font-black tracking-[0.2em] text-neutral-500 uppercase">{sideTag.slice(0, 6)}</span>
                      <span className="font-mono text-[8px] font-black tracking-[0.2em] text-neutral-400 uppercase">{s.side}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
