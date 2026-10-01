/**
 * GC-Stats - match-round-history
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { teamLogo, teamLogoLight } from "@/lib/home-fake-data";
import { winTypeIconUrl } from "@/lib/valorant-agents";
import type { MatchRound, MatchSide } from "@/lib/match-page-data";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

const REGULATION_LENGTH = 24;
const MAX_PER_LINE = 30;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function RoundCell({ round, side, entrantId, numberBelow }: { round: MatchRound; side: "a" | "b"; entrantId: number | null; numberBelow: boolean }) {
  const won = entrantId != null && round.winningEntrantId === entrantId;
  const color = side === "a" ? "blue" : "red";
  const number = (
    <span className={`font-mono text-[8px] leading-none font-black ${round.roundNumber > REGULATION_LENGTH ? "text-[#e4ae22]/70" : "text-neutral-600 group-hover:text-neutral-400"}`}>
      {String(round.roundNumber).padStart(2, "0")}
    </span>
  );

  return (
    <div className="group relative flex flex-col items-center gap-1">
      {!numberBelow && number}
      <div
        className={`flex aspect-square h-6 w-6 items-center justify-center rounded-md transition-all duration-300 ${
          won
            ? color === "blue"
              ? "border border-blue-500/30 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
              : "border border-red-500/30 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
            : "border border-neutral-800 bg-black/40 opacity-40"
        }`}
      >
        {won && (
          <img
            src={winTypeIconUrl(round.winType)}
            alt={round.winType ?? "timeout"}
            className={`h-3/4 w-3/4 object-contain brightness-110 ${color === "blue" ? "drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]" : "drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]"}`}
          />
        )}
      </div>
      {numberBelow && number}
      {round.roundNumber === 12 && <div className="absolute top-0 -right-1 bottom-0 w-px bg-white/10" />}
      {round.roundNumber === REGULATION_LENGTH + 1 && <div className="absolute top-0 -left-1 bottom-0 w-px bg-[#e4ae22]/30" />}
    </div>
  );
}

export function MatchRoundHistory({ rounds, a, b }: { rounds: MatchRound[]; a: MatchSide; b: MatchSide }) {
  const t = useTranslations("matchPage");
  if (rounds.length === 0) return null;
  const chunks = chunk(rounds, MAX_PER_LINE);
  const wrapped = chunks.length > 1;
  const teamAName = a.entrantId != null ? a.displayName : t("teamTbd");
  const teamBName = b.entrantId != null ? b.displayName : t("teamTbd");
  const logoA = a.logoUrl ?? teamLogo(a.shortName ?? "");
  const logoALight = a.logoUrlLight ?? a.logoUrl ?? teamLogoLight(a.shortName ?? "");
  const logoB = b.logoUrl ?? teamLogo(b.shortName ?? "");
  const logoBLight = b.logoUrlLight ?? b.logoUrl ?? teamLogoLight(b.shortName ?? "");

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-neutral-800 shadow-2xl" style={{ background: "var(--gcs-surface-2)" }} aria-label={t("roundHistory")}>
      <div className="space-y-3 p-4 md:hidden">
        <div className="grid grid-cols-[1.75rem_1fr] items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 p-1 shadow-[0_0_10px_rgba(59,130,246,0.4)]">
            <ThemedLogoImage dark={logoA} light={logoALight} alt={teamAName} width={28} height={28} className="h-full w-full object-contain" />
          </div>
          <span className="min-w-0 truncate text-center text-[11px] font-black text-[var(--gcs-text)] uppercase">{teamAName}</span>
        </div>
        <div className="grid grid-cols-[1.75rem_1fr] items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 p-1 shadow-[0_0_10px_rgba(239,68,68,0.4)]">
            <ThemedLogoImage dark={logoB} light={logoBLight} alt={teamBName} width={28} height={28} className="h-full w-full object-contain" />
          </div>
          <span className="min-w-0 truncate text-center text-[11px] font-black text-[var(--gcs-text)] uppercase">{teamBName}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {rounds.map((round) => {
            const wonByA = a.entrantId != null && round.winningEntrantId === a.entrantId;
            const wonByB = b.entrantId != null && round.winningEntrantId === b.entrantId;
            return (
              <div
                key={round.roundNumber}
                className={`flex aspect-square h-6 w-6 items-center justify-center rounded-md transition-all duration-300 ${
                  wonByA
                    ? "border border-blue-500/30 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                    : wonByB
                      ? "border border-red-500/30 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                      : "border border-neutral-800 bg-black/40 opacity-40"
                }`}
              >
                {(wonByA || wonByB) && (
                  <img
                    src={winTypeIconUrl(round.winType)}
                    alt={round.winType ?? "timeout"}
                    className={`h-3/4 w-3/4 object-contain brightness-110 ${wonByA ? "drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]" : "drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden space-y-2 p-6 md:block">
        <div className="space-y-2">
          {chunks.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 p-1.5 shadow-[0_0_10px_rgba(59,130,246,0.4)] ${i > 0 ? "invisible" : ""}`}>
                <ThemedLogoImage dark={logoA} light={logoALight} alt={teamAName} width={36} height={36} className="h-full w-full object-contain" />
              </div>
              <div className="grow overflow-hidden">
                <div className="grid items-end gap-1" style={{ gridTemplateColumns: `repeat(${wrapped ? MAX_PER_LINE : c.length}, minmax(0, 1fr))` }}>
                  {c.map((round) => (
                    <RoundCell key={round.roundNumber} round={round} side="a" entrantId={a.entrantId} numberBelow={false} />
                  ))}
                </div>
              </div>
              <div className="hidden w-12 md:block" />
            </div>
          ))}
        </div>

        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-white/20" style={{ background: "var(--gcs-surface-2)" }} />
        </div>

        <div className="space-y-2">
          {chunks.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 shadow-[0_0_10px_rgba(239,68,68,0.4)] ${i > 0 ? "invisible" : ""}`}>
                <ThemedLogoImage dark={logoB} light={logoBLight} alt={teamBName} width={36} height={36} className="h-full w-full object-contain" />
              </div>
              <div className="grow overflow-hidden">
                <div className="grid items-start gap-1" style={{ gridTemplateColumns: `repeat(${wrapped ? MAX_PER_LINE : c.length}, minmax(0, 1fr))` }}>
                  {c.map((round) => (
                    <RoundCell key={round.roundNumber} round={round} side="b" entrantId={b.entrantId} numberBelow />
                  ))}
                </div>
              </div>
              <div className="hidden w-12 md:block" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
