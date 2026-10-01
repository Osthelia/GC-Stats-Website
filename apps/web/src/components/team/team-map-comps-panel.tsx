/**
 * GC-Stats - team-map-comps-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AgentIcon } from "@/components/match/agent-icon";
import { FormattedDate } from "@/components/formatted-date";
import { PickRateList } from "@/components/tournament/pick-rate-list";
import { SegmentedTrack, SegmentedButton } from "@/components/stats/segmented";
import { GOLD, tint } from "@/lib/home-fake-data";
import { loadTeamCompMatches, type LoadTeamCompMatchesResult } from "@/actions/team-maps";
import type { MapsFilters } from "@/lib/maps-filters";
import type { TeamMapComp, TeamMapCompMatch, TeamMapPoolRow } from "@/lib/team-maps-data";
import type { TournamentMapPickRate } from "@/lib/tournament-maps-data";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className={`flex-none text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function compKey(mapName: string, comp: TeamMapComp): string {
  return `${mapName}|${comp.agents.join(",")}`;
}

/**
 * Compositions this team has drafted per map + agent pick rates — same
 * interaction/layout as the tournament maps page's comps panel, minus the
 * per-team badge breakdown (every comp here already belongs to this one
 * team). Comps are collapsed by default, opening one loads the matches it
 * was played in — mirrors V1's nested accordion on `team/maps.blade.php`.
 */
export function TeamMapCompsPanel({
  teamId,
  filters,
  mapPool,
  compsByMap,
  pickRatesByMap,
}: {
  teamId: number;
  filters: MapsFilters;
  mapPool: TeamMapPoolRow[];
  compsByMap: Record<string, TeamMapComp[]>;
  pickRatesByMap: Record<string, TournamentMapPickRate[]>;
}) {
  const t = useTranslations("teamPage");
  const [activeMap, setActiveMap] = useState(mapPool[0]?.mapName ?? "");
  const [openComps, setOpenComps] = useState<Set<string>>(new Set());
  // Matches per comp key, fetched the first time a comp is opened.
  const [matchesByKey, setMatchesByKey] = useState<Map<string, TeamMapCompMatch[] | "error">>(new Map());

  if (mapPool.length === 0) return null;

  const activeMapRow = mapPool.find((m) => m.mapName === activeMap);
  const comps = compsByMap[activeMap] ?? [];
  const pickRates = pickRatesByMap[activeMap] ?? [];

  const loadMatches = async (key: string, comp: TeamMapComp) => {
    let result: LoadTeamCompMatchesResult | null = null;
    try {
      result = await loadTeamCompMatches(teamId, activeMap, comp.agents, filters);
    } catch {
      result = null;
    }
    setMatchesByKey((prev) => new Map(prev).set(key, result?.ok ? result.matches : "error"));
  };

  const toggleComp = (key: string, comp: TeamMapComp) => {
    const opening = !openComps.has(key);
    setOpenComps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    const cached = matchesByKey.get(key);
    if (opening && (cached === undefined || cached === "error")) {
      if (cached === "error") setMatchesByKey((prev) => { const next = new Map(prev); next.delete(key); return next; });
      void loadMatches(key, comp);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SegmentedTrack>
        {mapPool.map((m) => (
          <SegmentedButton
            key={m.mapName}
            active={activeMap === m.mapName}
            onClick={() => setActiveMap(m.mapName)}
          >
            {m.mapName}
          </SegmentedButton>
        ))}
      </SegmentedTrack>

      {activeMapRow && (
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-lg border border-neutral-800 px-4 py-3"
          style={{ background: "var(--gcs-surface-2)" }}
        >
          <span className="text-[15px] font-bold text-neutral-100">
            {activeMapRow.mapName}
          </span>
          <span className="font-mono text-xs tabular-nums text-neutral-400">
            {t("mapsRecord")}{" "}
            <span
              className={
                activeMapRow.wins >= activeMapRow.losses
                  ? "text-[#3fb950]"
                  : "text-neutral-300"
              }
            >
              {activeMapRow.wins}-{activeMapRow.losses}
            </span>
          </span>
          <span className="font-mono text-xs tabular-nums text-neutral-400">
            {activeMapRow.timesPlayed} {t("mapsTimesPlayed").toLowerCase()}
          </span>
          <span
            className="font-mono text-xs tabular-nums"
            style={{
              color:
                activeMapRow.atkWinPct != null
                  ? "#f2555a"
                  : "var(--gcs-text-tertiary)",
            }}
          >
            {t("mapsAtkWin")}{" "}
            {activeMapRow.atkWinPct != null
              ? `${activeMapRow.atkWinPct}%`
              : "–"}
          </span>
          <span
            className="font-mono text-xs tabular-nums"
            style={{
              color:
                activeMapRow.defWinPct != null
                  ? "#4c8bf5"
                  : "var(--gcs-text-tertiary)",
            }}
          >
            {t("mapsDefWin")}{" "}
            {activeMapRow.defWinPct != null
              ? `${activeMapRow.defWinPct}%`
              : "–"}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="mb-2.5 text-[11px] font-black tracking-[0.14em] text-neutral-400 uppercase">
            {t("mapsCompsTitle")}
          </h3>
          {comps.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("mapsCompsEmpty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {comps.map((comp) => {
                const key = compKey(activeMap, comp);
                const open = openComps.has(key);
                const compMatches = matchesByKey.get(key);
                return (
                  <div
                    key={key}
                    className="overflow-hidden rounded-lg border border-neutral-800"
                    style={{ background: "var(--gcs-surface-2)" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleComp(key, comp)}
                      aria-expanded={open}
                      className="flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex flex-wrap gap-1">
                        {comp.agents.map((agent) => (
                          <AgentIcon key={agent} agent={agent} size="h-6 w-6" />
                        ))}
                      </div>
                      <div className="flex flex-none items-center gap-3">
                        <span className="font-mono text-xs tabular-nums text-neutral-400">
                          {t("mapsCompsPlayed", { count: comp.count })} ·{" "}
                          <span style={{ color: GOLD }}>
                            {comp.winPct ?? 0}%
                          </span>
                        </span>
                        <ChevronIcon open={open} />
                      </div>
                    </button>

                    {open && (
                      <div className="flex flex-col gap-1 border-t border-neutral-800 p-2">
                        {compMatches === undefined ? (
                          <p className="flex items-center gap-2 px-2 py-2 text-xs text-neutral-500" role="status">
                            <span className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-400" />
                            {t("mapsCompsLoading")}
                          </p>
                        ) : compMatches === "error" ? (
                          <p className="px-2 py-2 text-xs text-[#f2555a]">
                            {t("mapsCompsLoadError")}
                          </p>
                        ) : compMatches.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-neutral-500">
                            {t("mapsCompsEmpty")}
                          </p>
                        ) : (
                          compMatches.map((m) => (
                            <Link
                              key={m.matchId}
                              href={`/match/${m.matchId}`}
                              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-neutral-400 transition-colors hover:bg-white/[0.03] hover:text-neutral-100"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-1.5 w-1.5 flex-none rounded-full"
                                  style={{
                                    background: m.won
                                      ? "#3fb950"
                                      : tint("#f2555a", 0.7),
                                  }}
                                />
                                <span className="truncate">
                                  {t("mapsVs")} {m.opponent}
                                </span>
                              </span>
                              <span className="flex flex-none items-center gap-2">
                                <FormattedDate
                                  date={m.scheduledAt}
                                  mode="date"
                                  className="text-neutral-600"
                                />
                                <span className="font-mono tabular-nums text-neutral-300">
                                  {m.ownScore}-{m.oppScore}
                                </span>
                              </span>
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-2.5 text-[11px] font-black tracking-[0.14em] text-neutral-400 uppercase">
            {t("mapsPickRatesTitle")}
          </h3>
          <PickRateList
            rates={pickRates}
            emptyLabel={t("mapsPickRatesEmpty")}
          />
        </div>
      </div>
    </div>
  );
}
