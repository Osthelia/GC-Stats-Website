/**
 * GC-Stats - global-match-row
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";
import { GOLD, RED, REGIONS, tint } from "@/lib/home-fake-data";
import type { HomeMatch } from "@/lib/home-data";
import { TeamBadge } from "@/components/home/team-badge";
import { FormattedDate } from "@/components/formatted-date";

/**
 * Row for the global /match list. Unlike `MatchCard` (team overview/matches
 * tabs, which has a "us" to render a W/L badge for), this list has no
 * perspective — every finished match simply has a winner and a loser, so
 * the winner's name/score is emphasized directly instead of a colored
 * win/loss badge.
 *
 * Team block is logo-above-name, centered both ways and symmetric around the
 * score (poster-style) — first attempt had name+logo side by side in a row,
 * which meant a wrapping/long name on one side threw off vertical alignment
 * against the other side. Stacking removes that: each team block always
 * centers on its own axis regardless of name length.
 */
export function GlobalMatchRow({ match: m, vsLabel }: { match: HomeMatch; vsLabel: string }) {
  const live = m.status === "live";
  const done = m.status === "finished";
  const winA = done && m.leader === "a";
  const winB = done && m.leader === "b";
  const region = REGIONS[m.region] ?? REGIONS.other;

  return (
    <Link
      href={`/match/${m.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] px-5 py-4 transition-all hover:border-neutral-700 hover:bg-[var(--gcs-hover)]"
      style={{ borderLeft: `3px solid ${region.color}` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/70 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: region.color }} />
          <span className="text-xs font-semibold" style={{ color: region.color }}>
            {region.label}
          </span>
          <span className="text-neutral-700">·</span>
          <span className="truncate text-xs font-medium text-neutral-400">{m.event}</span>
          {m.stage && (
            <>
              <span className="text-neutral-700">·</span>
              <span className="truncate text-xs text-neutral-600">{m.stage}</span>
            </>
          )}
        </div>

        {live ? (
          <span className="flex flex-none items-center gap-1.5 rounded-md px-2 py-0.5" style={{ background: tint(RED, 0.16) }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: RED }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: RED }} />
            </span>
            <span className="text-[10.5px] font-black tracking-wide" style={{ color: RED }}>
              LIVE
            </span>
          </span>
        ) : (
          <div className="flex flex-none items-center gap-2 font-mono text-xs text-neutral-500">
            <FormattedDate date={m.scheduledAt} mode="date" dateOptions={{ day: "numeric", month: "short", year: "numeric" }} />
            <span className="text-neutral-700">·</span>
            <FormattedDate date={m.scheduledAt} mode="time" />
            <span className="text-neutral-700">·</span>
            <span>{m.format}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 sm:gap-10">
        <div className="flex w-32 flex-none flex-col items-center gap-2 text-center sm:w-48">
          <TeamBadge tag={m.aTag} logoUrl={m.aLogoUrl} logoUrlLight={m.aLogoUrlLight} size={44} />
          <span className="w-full truncate text-[15px] tracking-tight" style={{ fontWeight: winA ? 700 : 500, color: winA ? GOLD : done ? "var(--gcs-text-tertiary)" : "var(--gcs-text)" }}>
            {m.aName}
          </span>
        </div>

        <div className="flex flex-none items-center gap-2.5 font-mono text-2xl font-black tabular-nums">
          {done || live ? (
            <>
              <span style={{ color: winA ? GOLD : done ? "var(--gcs-text-tertiary)" : "var(--gcs-text)" }}>{m.aScore}</span>
              <span className="text-base font-medium text-neutral-700">–</span>
              <span style={{ color: winB ? GOLD : done ? "var(--gcs-text-tertiary)" : "var(--gcs-text)" }}>{m.bScore}</span>
            </>
          ) : (
            <span className="text-xs font-semibold text-neutral-600">{vsLabel}</span>
          )}
        </div>

        <div className="flex w-32 flex-none flex-col items-center gap-2 text-center sm:w-48">
          <TeamBadge tag={m.bTag} logoUrl={m.bLogoUrl} logoUrlLight={m.bLogoUrlLight} size={44} />
          <span className="w-full truncate text-[15px] tracking-tight" style={{ fontWeight: winB ? 700 : 500, color: winB ? GOLD : done ? "var(--gcs-text-tertiary)" : "var(--gcs-text)" }}>
            {m.bName}
          </span>
        </div>
      </div>
    </Link>
  );
}
