/**
 * GC-Stats - matches-list
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GOLD, RED, tint } from "@/lib/theme-colors";
import type { HomeMatch } from "@/lib/home-data";
import { MatchCard } from "@/components/matches/match-card";

export type MatchStatusTab = "all" | "live" | "upcoming" | "finished";

/**
 * Match list shared by any entity's "Matches" tab (team, player, tournament).
 * The status tabs are links: filtering, counts and pagination are done server side.
 */
export function MatchesList({
  matches,
  emptyLabel,
  activeStatus,
  statusCounts,
  statusHrefs,
  highlightWinner = true,
}: {
  matches: HomeMatch[];
  emptyLabel: string;
  activeStatus: MatchStatusTab;
  statusCounts: Record<MatchStatusTab, number>;
  statusHrefs: Record<MatchStatusTab, string>;
  /** See `MatchCard`, pass `false` on a page with no "home side" (e.g. a tournament). */
  highlightWinner?: boolean;
}) {
  const home = useTranslations("home");

  const tabs: { key: MatchStatusTab; label: string; live?: boolean }[] = [
    { key: "all", label: home("tabAll") },
    { key: "live", label: home("tabLive"), live: true },
    { key: "upcoming", label: home("tabUpcoming") },
    { key: "finished", label: home("tabResults") },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const on = activeStatus === tab.key;
          const isLive = !!tab.live;
          return (
            <Link
              key={tab.key}
              href={statusHrefs[tab.key]}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] transition-all hover:-translate-y-px active:translate-y-0"
              style={{
                background: on ? (isLive ? RED : GOLD) : "transparent",
                color: on ? "#0e0e0e" : isLive ? "#d8888b" : "var(--gcs-text-secondary)",
                borderColor: on ? (isLive ? RED : GOLD) : isLive ? tint(RED, 0.35) : "var(--gcs-border)",
                fontWeight: on ? 600 : 500,
              }}
            >
              {tab.live && <span className="h-1.5 w-1.5 flex-none animate-pulse rounded-full" style={{ background: on ? "#0e0e0e" : RED }} />}
              <span>{tab.label}</span>
              <span className="text-xs font-medium tabular-nums" style={{ color: on ? "rgba(14,14,14,.55)" : "var(--gcs-text-tertiary)" }}>
                {statusCounts[tab.key]}
              </span>
            </Link>
          );
        })}
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <div className="@container flex flex-col gap-2.5">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} vsLabel={home("vs")} highlightWinner={highlightWinner} />
          ))}
        </div>
      )}
    </div>
  );
}
