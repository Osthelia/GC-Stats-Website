/**
 * GC-Stats - match-performance-economy
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import type { MatchEcoSummary, MatchPerformance, MatchMapPlayerRow, EcoTierKey } from "@/lib/match-page-data";

const BUY_COLORS: Record<EcoTierKey, string> = {
  eco: "bg-neutral-500",
  semi_eco: "bg-blue-400",
  semi_buy: "bg-cyan-400",
  full_buy: "bg-[#e4ae22]",
};

const PERF_GRID_COLS = "1fr repeat(5,56px) 24px repeat(5,56px) 1fr";
const PERF_GRID_COLS_MOBILE = "minmax(0,1fr) repeat(5,40px)";

function cellColor(v: number): string {
  if (v === 0) return "text-neutral-600";
  if (v >= 3) return "text-green-400";
  return "text-neutral-100";
}

export function MatchPerformanceEconomy({
  statsA,
  statsB,
  teamAName,
  teamBName,
  performance,
  ecoSummary,
}: {
  statsA: MatchMapPlayerRow[];
  statsB: MatchMapPlayerRow[];
  teamAName: string;
  teamBName: string;
  performance: MatchPerformance;
  ecoSummary: MatchEcoSummary;
}) {
  const t = useTranslations("matchPage");
  const rowCount = Math.max(statsA.length, statsB.length);
  const hasEcoA = Object.values(ecoSummary.teamA).some((tier) => tier.total > 0);
  const hasEcoB = Object.values(ecoSummary.teamB).some((tier) => tier.total > 0);
  const hasPerformance = statsA.some((s) => s.personId != null && performance[s.personId]) || statsB.some((s) => s.personId != null && performance[s.personId]);

  if (!hasPerformance && !hasEcoA && !hasEcoB) return null;

  const tierLabel = (key: EcoTierKey) => t(TIER_LABEL_KEYS[key]);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-2)" }}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-neutral-800 px-5 py-4">
        <div className="min-w-0">
          <span className="block truncate text-sm font-black text-[var(--gcs-text)] italic">{teamAName}</span>
        </div>
        <span className="shrink-0 px-2 text-center text-[11px] font-black tracking-[0.2em] whitespace-nowrap text-neutral-300 uppercase">{t("performance")}</span>
        <div className="min-w-0 text-right">
          <span className="block truncate text-sm font-black text-[var(--gcs-text)] italic">{teamBName}</span>
        </div>
      </div>

      <div className="p-5">
        {hasPerformance && (
          <>
            <div className="no-scrollbar hidden overflow-x-auto md:block">
              <div className="min-w-[640px]">
                <div className="grid items-center px-1 py-2 text-[11px] font-semibold text-neutral-500 uppercase" style={{ gridTemplateColumns: PERF_GRID_COLS }}>
                  <div>{t("colPlayer")}</div>
                  <div className="text-center">SHF</div>
                  <div className="text-center">2K</div>
                  <div className="text-center">3K</div>
                  <div className="text-center">4K</div>
                  <div className="text-center">5K</div>
                  <div />
                  <div className="text-center">5K</div>
                  <div className="text-center">4K</div>
                  <div className="text-center">3K</div>
                  <div className="text-center">2K</div>
                  <div className="text-center">SHF</div>
                  <div className="text-right">{t("colPlayer")}</div>
                </div>

                {Array.from({ length: rowCount }).map((_, i) => {
                  const left = statsA[i] ?? null;
                  const right = statsB[i] ?? null;
                  const pfA = left?.personId != null ? performance[left.personId] : undefined;
                  const pfB = right?.personId != null ? performance[right.personId] : undefined;
                  return (
                    <div key={i} className={`grid items-center rounded-md px-1 py-2 ${i % 2 === 1 ? "bg-white/[0.015]" : ""}`} style={{ gridTemplateColumns: PERF_GRID_COLS }}>
                      <div className="truncate px-1 text-[13px] font-black text-[var(--gcs-text)] italic">{left?.handle ?? "-"}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfA?.sheriffKills ?? 0)}`}>{pfA?.sheriffKills ?? 0}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfA?.k2 ?? 0)}`}>{pfA?.k2 ?? 0}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfA?.k3 ?? 0)}`}>{pfA?.k3 ?? 0}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfA?.k4 ?? 0)}`}>{pfA?.k4 ?? 0}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfA?.k5 ?? 0)}`}>{pfA?.k5 ?? 0}</div>
                      <div />
                      <div className={`text-center text-[13px] ${cellColor(pfB?.k5 ?? 0)}`}>{pfB?.k5 ?? 0}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfB?.k4 ?? 0)}`}>{pfB?.k4 ?? 0}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfB?.k3 ?? 0)}`}>{pfB?.k3 ?? 0}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfB?.k2 ?? 0)}`}>{pfB?.k2 ?? 0}</div>
                      <div className={`text-center text-[13px] ${cellColor(pfB?.sheriffKills ?? 0)}`}>{pfB?.sheriffKills ?? 0}</div>
                      <div className="truncate px-1 text-right text-[13px] font-black text-[var(--gcs-text)] italic">{right?.handle ?? "-"}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 md:hidden">
              {[
                { name: teamAName, stats: statsA },
                { name: teamBName, stats: statsB },
              ].map((team) => (
                <div key={team.name}>
                  <div className="mb-2 text-center text-[13px] font-black tracking-wide text-[var(--gcs-text)] uppercase italic">{team.name}</div>
                  <div className="grid items-center px-1 py-1.5 text-[10px] font-semibold text-neutral-500 uppercase" style={{ gridTemplateColumns: PERF_GRID_COLS_MOBILE }}>
                    <div>{t("colPlayer")}</div>
                    <div className="text-center">SHF</div>
                    <div className="text-center">2K</div>
                    <div className="text-center">3K</div>
                    <div className="text-center">4K</div>
                    <div className="text-center">5K</div>
                  </div>
                  {team.stats.map((s, i) => {
                    const pf = s.personId != null ? performance[s.personId] : undefined;
                    return (
                      <div key={i} className={`grid items-center rounded-md px-1 py-2 ${i % 2 === 1 ? "bg-white/[0.015]" : ""}`} style={{ gridTemplateColumns: PERF_GRID_COLS_MOBILE }}>
                        <div className="truncate text-[12px] font-black text-[var(--gcs-text)] italic">{s.handle}</div>
                        <div className={`text-center text-[12px] ${cellColor(pf?.sheriffKills ?? 0)}`}>{pf?.sheriffKills ?? 0}</div>
                        <div className={`text-center text-[12px] ${cellColor(pf?.k2 ?? 0)}`}>{pf?.k2 ?? 0}</div>
                        <div className={`text-center text-[12px] ${cellColor(pf?.k3 ?? 0)}`}>{pf?.k3 ?? 0}</div>
                        <div className={`text-center text-[12px] ${cellColor(pf?.k4 ?? 0)}`}>{pf?.k4 ?? 0}</div>
                        <div className={`text-center text-[12px] ${cellColor(pf?.k5 ?? 0)}`}>{pf?.k5 ?? 0}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        {(hasEcoA || hasEcoB) && (
          <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 ${hasPerformance ? "mt-6" : ""}`}>
            {[
              { has: hasEcoA, name: teamAName, tiers: ecoSummary.teamA },
              { has: hasEcoB, name: teamBName, tiers: ecoSummary.teamB },
            ].map(
              (side, i) =>
                side.has && (
                  <div key={i} className="rounded-xl border border-neutral-800 p-4" style={{ background: "var(--gcs-surface-2)" }}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="truncate text-[13px] font-black text-[var(--gcs-text)]">{t("economy", { team: side.name })}</span>
                    </div>
                    {ECO_TIER_KEYS.map((key) => {
                      const tier = side.tiers[key];
                      const pct = tier.total > 0 ? Math.round((tier.win / tier.total) * 100) : 0;
                      return (
                        <div key={key} className="mb-2.5 last:mb-0">
                          <div className="mb-1 flex justify-between text-[12px]">
                            <span className="text-neutral-400">{tierLabel(key)}</span>
                            <span className="font-bold text-[var(--gcs-text)]">
                              {tier.win}
                              <span className="text-neutral-600">/</span>
                              {tier.total}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                            <div className={`h-full ${BUY_COLORS[key]}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ECO_TIER_KEYS: EcoTierKey[] = ["eco", "semi_eco", "semi_buy", "full_buy"];
const TIER_LABEL_KEYS = {
  eco: "ecoTierEco",
  semi_eco: "ecoTierSemiEco",
  semi_buy: "ecoTierSemiBuy",
  full_buy: "ecoTierFullBuy",
} as const;
