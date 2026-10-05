/**
 * GC-Stats - match-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";
import { RED, tint } from "@/lib/theme-colors";
import { REGIONS } from "@/lib/tournament-regions";
import type { HomeMatch } from "@/lib/home-data";
import { TeamBadge } from "@/components/home/team-badge";
import { FormattedDate } from "@/components/formatted-date";

const WIN = "#2fbf6e";
const LOSS = RED;

/**
 * Match row shared by every entity page that lists matches (team overview/matches
 * tab, player overview/matches tab, ...). One match per row (industry standard),
 * not the roster card's shape (left accent bar + square avatar + stacked text)
 * and not the home feed's row either, so the lists on those pages don't blur
 * together: teams + result are the dominant element here (bigger names, bigger
 * score, colored win/loss), tournament context is pushed to a smaller secondary
 * column on the right.
 */
export function MatchCard({
  match: m,
  vsLabel,
  highlightWinner = true,
}: {
  match: HomeMatch;
  vsLabel: string;
  /** Gates every win/loss visual cue (W/L badge, colored left border, dimmed
   * loser name, colored score) — only meaningful on a team/player page where
   * the reader has "their" side. A tournament match list passes `false`. */
  highlightWinner?: boolean;
}) {
  const live = m.status === "live";
  const done = m.status === "finished";
  const won = highlightWinner && done && m.leader === "a";
  const lost = highlightWinner && done && m.leader === "b";
  const region = REGIONS[m.region] ?? REGIONS.other;
  const resultColor = live ? RED : won ? WIN : lost ? LOSS : null;

  return (
    <Link
      href={`/match/${m.id}`}
      className="gcs-accent-card group flex items-center gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] py-3 pl-3.5 pr-4 transition-all duration-200 hover:translate-x-1 hover:border-neutral-700 hover:bg-[var(--gcs-hover)] active:scale-[0.99] @min-[480px]:gap-4"
      style={{ borderLeft: `3px solid ${resultColor ?? "var(--gcs-border)"}` }}
    >
      {/* Status + date — always visible, never hidden responsively */}
      <div className="flex w-[52px] flex-none flex-col items-start gap-1 @min-[480px]:w-[64px]">
        {live ? (
          <span className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 flex-none animate-pulse rounded-full"
              style={{ background: RED }}
            />
            <span
              className="text-[10.5px] font-black tracking-wide"
              style={{ color: RED }}
            >
              LIVE
            </span>
          </span>
        ) : done && highlightWinner ? (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-black tracking-wide"
            style={{
              background: resultColor
                ? tint(resultColor, 0.16)
                : "rgba(255,255,255,0.07)",
              color: resultColor ?? "var(--gcs-text-secondary)",
            }}
          >
            {won ? "W" : lost ? "L" : "–"}
          </span>
        ) : (
          <FormattedDate
            date={m.scheduledAt}
            mode="time"
            className="font-mono text-[10.5px] font-semibold text-neutral-400"
          />
        )}
        <FormattedDate
          date={m.scheduledAt}
          mode="date"
          dateOptions={{ day: "numeric", month: "short" }}
          className="font-mono text-[10px] text-neutral-600"
        />
      </div>

      {/* Narrow container: one team per line, score on the right, so names keep their width */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 @min-[480px]:hidden">
        <StackedTeamLine
          name={m.aName}
          tag={m.aTag}
          logoUrl={m.aLogoUrl}
          logoUrlLight={m.aLogoUrlLight}
          score={done || live ? m.aScore : null}
          nameColor={lost ? "var(--gcs-text-secondary)" : "var(--gcs-text)"}
          scoreColor={
            won ? WIN : done ? "var(--gcs-text-tertiary)" : "var(--gcs-text)"
          }
        />
        <StackedTeamLine
          name={m.bName}
          tag={m.bTag}
          logoUrl={m.bLogoUrl}
          logoUrlLight={m.bLogoUrlLight}
          score={done || live ? m.bScore : null}
          nameColor={won ? "var(--gcs-text-secondary)" : "var(--gcs-text)"}
          scoreColor={
            lost ? LOSS : done ? "var(--gcs-text-tertiary)" : "var(--gcs-text)"
          }
        />
      </div>

      {/* Teams + score — the primary info */}
      <div className="hidden min-w-0 flex-1 items-center gap-3 @min-[480px]:flex">
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
          {/* Capped in `ch` (not just `truncate`, which only kicks in once
              the flex container runs out of room) so a long name always
              ellipsizes the same way regardless of how wide the surrounding
              column happens to be — the column width shouldn't have to grow
              to accommodate outlier names. */}
          <span
            className="max-w-[15ch] truncate text-[15px] font-bold tracking-tight"
            style={{
              color: lost ? "var(--gcs-text-secondary)" : "var(--gcs-text)",
            }}
          >
            {m.aName}
          </span>
          <TeamBadge
            tag={m.aTag}
            logoUrl={m.aLogoUrl}
            logoUrlLight={m.aLogoUrlLight}
            size={30}
          />
        </div>

        <div className="flex flex-none items-center gap-2 font-mono text-lg font-black tabular-nums">
          {done || live ? (
            <>
              <span
                style={{
                  color: won
                    ? WIN
                    : done
                      ? "var(--gcs-text-tertiary)"
                      : "var(--gcs-text)",
                }}
              >
                {m.aScore}
              </span>
              <span className="text-sm font-medium text-neutral-700">–</span>
              <span
                style={{
                  color: lost
                    ? LOSS
                    : done
                      ? "var(--gcs-text-tertiary)"
                      : "var(--gcs-text)",
                }}
              >
                {m.bScore}
              </span>
            </>
          ) : (
            <span className="text-xs font-semibold text-neutral-600">
              {vsLabel}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TeamBadge
            tag={m.bTag}
            logoUrl={m.bLogoUrl}
            logoUrlLight={m.bLogoUrlLight}
            size={30}
          />
          <span
            className="max-w-[15ch] truncate text-[15px] font-bold tracking-tight"
            style={{
              color: won ? "var(--gcs-text-secondary)" : "var(--gcs-text)",
            }}
          >
            {m.bName}
          </span>
        </div>
      </div>

      {/* Tournament — secondary info. Never truncated: a full tournament name
          (e.g. "GC 2026: North America Stage 3") must stay fully readable
          rather than getting ellipsis-cut, per explicit user request — wraps
          to a second line instead of hiding text. Shown only once the card's
          own container is wide enough for its fixed 240px width (container
          query, not a viewport breakpoint) — a viewport-based `sm:` used to
          force it visible even inside a narrow sidebar (tournament page's
          "recent matches" column), overflowing the card with long stage
          names like "Lower Bracket Round 3". */}
      <div className="hidden min-w-0 flex-none text-right @min-[560px]:block @min-[560px]:w-[240px]">
        <div className="flex items-start justify-end gap-1.5">
          <span
            className="mt-1 h-1.5 w-1.5 flex-none rounded-sm"
            style={{ background: region.color }}
          />
          <span className="text-[12px] leading-snug font-medium text-neutral-400">
            {m.event}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-neutral-600">
          {m.stage || m.format}
        </div>
      </div>
    </Link>
  );
}

function StackedTeamLine({
  name,
  tag,
  logoUrl,
  logoUrlLight,
  score,
  nameColor,
  scoreColor,
}: {
  name: string;
  tag: string;
  logoUrl: string | null;
  logoUrlLight: string | null;
  score: string | number | null;
  nameColor: string;
  scoreColor: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <TeamBadge
        tag={tag}
        logoUrl={logoUrl}
        logoUrlLight={logoUrlLight}
        size={22}
      />
      <span
        className="min-w-0 flex-1 truncate text-[14px] font-bold tracking-tight"
        style={{ color: nameColor }}
      >
        {name}
      </span>
      {score != null && (
        <span
          className="flex-none font-mono text-base font-black tabular-nums"
          style={{ color: scoreColor }}
        >
          {score}
        </span>
      )}
    </div>
  );
}
