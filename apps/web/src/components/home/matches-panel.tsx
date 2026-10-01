/**
 * GC-Stats - matches-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  GOLD,
  RED,
  REGIONS,
  tint,
  type MatchStatus,
} from "@/lib/home-fake-data";
import type { HomeDay, HomeMatchDaysPage } from "@/lib/home-data";
import { compareDayOrder, sortDayMatches } from "@/lib/home-day-order";
import { loadMoreHomeMatches } from "@/actions/home";
import { TeamBadge } from "@/components/home/team-badge";
import { FormattedDate } from "@/components/formatted-date";

type FilterKey = "all" | MatchStatus;

// Phones only show the first few matches until "Load more", so tournaments and news stay close.
const MOBILE_INITIAL_MATCHES = 6;

function mergeDays(current: HomeDay[], extra: HomeDay[]): HomeDay[] {
  const byKey = new Map(current.map((d) => [d.dayKey, d]));
  for (const day of extra) {
    const existing = byKey.get(day.dayKey);
    if (!existing) {
      byKey.set(day.dayKey, day);
      continue;
    }
    const byId = new Map(existing.matches.map((m) => [m.id, m]));
    for (const m of day.matches) byId.set(m.id, m);
    byKey.set(day.dayKey, {
      ...existing,
      matches: sortDayMatches([...byId.values()], existing.dayOffset),
    });
  }
  return [...byKey.values()].sort(compareDayOrder);
}

export function MatchesPanel({ initialPage }: { initialPage: HomeMatchDaysPage }) {
  const t = useTranslations("home");
  const locale = useLocale() as AppLocale;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [allDays, setAllDays] = useState<HomeDay[]>(initialPage.days);
  const [offset, setOffset] = useState(initialPage.nextOffset);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [isLoadingMore, startLoadMore] = useTransition();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const handleLoadMore = () => {
    startLoadMore(async () => {
      const page = await loadMoreHomeMatches(offset, locale);
      setAllDays((prev) => mergeDays(prev, page.days));
      setOffset(page.nextOffset);
      setHasMore(page.hasMore);
    });
  };

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: 0,
      live: 0,
      upcoming: 0,
      finished: 0,
    };
    for (const day of allDays)
      for (const m of day.matches) {
        c.all++;
        c[m.status]++;
      }
    return c;
  }, [allDays]);

  const days = useMemo(() => {
    // "All", by definition, holds everything fetched (past + future) — no
    // day restriction. Every tab shares the same base order (compareDayOrder,
    // future ascending then past descending): for "upcoming" (offsets >= 0)
    // that's already soonest-first, for "finished" (offsets <= 0) that's
    // already most-recent-first — no per-tab reversal needed.
    if (filter === "all") return allDays;
    return allDays
      .map((day) => ({
        ...day,
        matches: day.matches.filter((m) => m.status === filter),
      }))
      .filter((day) => day.matches.length > 0);
  }, [allDays, filter]);

  // Marks the day where the "Tous" list first crosses from today/future into
  // past results, so the change in meaning (schedule vs. results) is called
  // out once instead of left implicit.
  const pastSectionStartKey = useMemo(() => {
    if (filter !== "all") return null;
    const firstPast = allDays.find((d) => d.dayOffset < 0);
    return firstPast?.dayKey ?? null;
  }, [allDays, filter]);
  const upcomingSectionStartKey = useMemo(() => {
    if (filter !== "all") return null;
    const firstUpcoming = allDays.find((d) => d.dayOffset > 0);
    return firstUpcoming?.dayKey ?? null;
  }, [allDays, filter]);

  // Global index of each day's first match, to hide everything past the mobile cap with CSS only (no hydration flash).
  const dayStartIndex = useMemo(() => {
    const starts: number[] = [];
    let n = 0;
    for (const day of days) {
      starts.push(n);
      n += day.matches.length;
    }
    return starts;
  }, [days]);
  const visibleCount = days.reduce((n, d) => n + d.matches.length, 0);
  const mobileCapped = !mobileExpanded && visibleCount > MOBILE_INITIAL_MATCHES;

  const tabs: { key: FilterKey; label: string; live?: boolean }[] = [
    { key: "all", label: t("tabAll") },
    { key: "live", label: t("tabLive"), live: true },
    { key: "upcoming", label: t("tabUpcoming") },
    { key: "finished", label: t("tabResults") },
  ];

  return (
    <section className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-bold tracking-tight text-neutral-50">
          {t("matchesHeading")}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const on = filter === tab.key;
            const isLive = !!tab.live;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFilter(tab.key);
                  setMobileExpanded(false);
                }}
                className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] transition-all hover:-translate-y-px active:translate-y-0"
                style={{
                  background: on
                    ? isLive
                      ? RED
                      : "var(--gcs-text)"
                    : "transparent",
                  color: on
                    ? "var(--gcs-bg)"
                    : isLive
                      ? "#d8888b"
                      : "var(--gcs-text-secondary)",
                  borderColor: on
                    ? isLive
                      ? RED
                      : "var(--gcs-text)"
                    : isLive
                      ? tint(RED, 0.35)
                      : "var(--gcs-border)",
                  fontWeight: on ? 600 : 500,
                }}
              >
                {tab.live && (
                  <span
                    className="h-1.5 w-1.5 flex-none animate-pulse rounded-full"
                    style={{ background: on ? "var(--gcs-bg)" : RED }}
                  />
                )}
                <span>{tab.label}</span>
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{
                    color: on
                      ? "color-mix(in srgb, var(--gcs-bg) 55%, transparent)"
                      : "var(--gcs-text-tertiary)",
                  }}
                >
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-[26px]">
        {days.map((day, dayIndex) => (
          <div
            key={day.dayKey}
            className={
              mobileCapped && dayStartIndex[dayIndex]! >= MOBILE_INITIAL_MATCHES
                ? "max-md:hidden"
                : undefined
            }
          >
            {day.dayKey === upcomingSectionStartKey && (
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                {t("sectionUpcoming")}
              </div>
            )}
            {day.dayKey === pastSectionStartKey && (
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                {t("sectionPast")}
              </div>
            )}
            <div className="mb-2.5 flex items-baseline gap-2 pl-0.5">
              <span className="text-sm font-semibold tracking-tight text-neutral-50">
                {day.label}
              </span>
              <span className="text-[13px] text-neutral-600">{day.date}</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)]">
              {day.matches.map((m, i) =>
                mobileCapped &&
                dayStartIndex[dayIndex]! + i >= MOBILE_INITIAL_MATCHES ? (
                  <div key={m.id} className="max-md:hidden">
                    <MatchRow match={m} vsLabel={t("vs")} />
                  </div>
                ) : (
                  <MatchRow key={m.id} match={m} vsLabel={t("vs")} />
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      {mobileCapped && (
        <button
          type="button"
          onClick={() => setMobileExpanded(true)}
          className="mt-[22px] flex h-11 w-full items-center justify-center rounded-[11px] border border-neutral-800 text-sm font-semibold text-neutral-400 transition-colors hover:border-[#5c4c22] hover:text-[#e4ae22] active:scale-[0.99] md:hidden"
        >
          {t("loadMore")}
        </button>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className={`mt-[22px] h-11 w-full items-center justify-center rounded-[11px] border border-neutral-800 text-sm font-semibold text-neutral-400 transition-colors hover:border-[#5c4c22] hover:text-[#e4ae22] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 ${mobileCapped ? "hidden md:flex" : "flex"}`}
        >
          {isLoadingMore ? t("loadingMore") : t("loadMore")}
        </button>
      )}
    </section>
  );
}

const nameClass =
  "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] tracking-tight min-[781px]:text-[14.5px]";
const scoreClass =
  "min-w-[9px] text-[14px] font-bold tabular-nums min-[781px]:text-[15px]";
const badgeSizeClass = "size-[22px] min-[781px]:size-[30px]";

export function MatchRow({
  match: m,
  vsLabel,
}: {
  match: HomeDay["matches"][number];
  vsLabel: string;
}) {
  const done = m.status === "finished";
  const live = m.status === "live";
  const pending = m.status === "upcoming";
  // Falls back to REGIONS.other rather than crash: an unrecognized region
  // must render with a neutral color, never take the page down.
  const region = REGIONS[m.region] ?? REGIONS.other;
  const winA = m.leader === "a";
  const winB = m.leader === "b";
  const nameStyle = (win: boolean) => ({
    fontWeight: win ? 600 : 500,
    color: done && !win ? "var(--gcs-text-tertiary)" : "var(--gcs-text)",
  });
  const scoreColor = (win: boolean) =>
    win
      ? live
        ? RED
        : GOLD
      : done
        ? "var(--gcs-text-tertiary)"
        : "var(--gcs-text-secondary)";

  return (
    <Link
      href={`/match/${m.id}`}
      className="grid h-16 grid-cols-[66px_minmax(0,1fr)_240px] items-center gap-4 border-t border-neutral-900 py-0 pl-[15px] pr-[18px] transition-colors hover:bg-black/25 max-[780px]:grid-cols-[58px_minmax(0,1fr)]"
      style={{ borderLeft: `3px solid ${region.color}` }}
    >
      <div className="min-w-0">
        {live ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-md py-1 pl-1.5 pr-2"
            style={{ background: tint(RED, 0.14) }}
          >
            <span
              className="h-1.5 w-1.5 flex-none animate-pulse rounded-full"
              style={{ background: RED }}
            />
            <span
              className="text-[11.5px] font-semibold tracking-tight"
              style={{ color: RED }}
            >
              LIVE
            </span>
          </div>
        ) : (
          <>
            <FormattedDate
              date={m.scheduledAt}
              mode="time"
              className="text-sm font-semibold tabular-nums tracking-tight"
              style={{
                color: done ? "var(--gcs-text-secondary)" : "var(--gcs-text)",
              }}
            />
            <div className="mt-0.5 text-xs text-neutral-600">{m.format}</div>
          </>
        )}
      </div>

      {/* One set of badges: 2 rows on mobile, a single centered line from 781px. */}
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 min-[781px]:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto_minmax(0,1fr)] min-[781px]:gap-x-1.5 min-[781px]:gap-y-0">
        <span
          className={`${nameClass} col-start-2 row-start-1 min-[781px]:col-start-1 min-[781px]:mr-1 min-[781px]:text-right`}
          style={nameStyle(winA)}
        >
          {m.aName}
        </span>
        <TeamBadge
          tag={m.aTag}
          logoUrl={m.aLogoUrl}
          logoUrlLight={m.aLogoUrlLight}
          sizeClassName={`${badgeSizeClass} col-start-1 row-start-1 min-[781px]:col-start-2 min-[781px]:mr-2`}
        />
        {done || live ? (
          <>
            <span
              className={`${scoreClass} col-start-3 row-start-1 text-right`}
              style={{ color: scoreColor(winA) }}
            >
              {m.aScore}
            </span>
            <span className="col-start-4 row-start-1 hidden text-xs font-medium text-neutral-700 min-[781px]:block">
              -
            </span>
            <span
              className={`${scoreClass} col-start-3 row-start-2 text-right min-[781px]:col-start-5 min-[781px]:row-start-1 min-[781px]:text-left`}
              style={{ color: scoreColor(winB) }}
            >
              {m.bScore}
            </span>
          </>
        ) : (
          pending && (
            <span className="col-start-3 row-start-2 text-[11.5px] font-medium text-neutral-600 min-[781px]:col-span-3 min-[781px]:row-start-1 min-[781px]:justify-self-center min-[781px]:text-[12.5px]">
              {vsLabel}
            </span>
          )
        )}
        <TeamBadge
          tag={m.bTag}
          logoUrl={m.bLogoUrl}
          logoUrlLight={m.bLogoUrlLight}
          sizeClassName={`${badgeSizeClass} col-start-1 row-start-2 min-[781px]:col-start-6 min-[781px]:row-start-1 min-[781px]:ml-2`}
        />
        <span
          className={`${nameClass} col-start-2 row-start-2 min-[781px]:col-start-7 min-[781px]:row-start-1 min-[781px]:ml-1`}
          style={nameStyle(winB)}
        >
          {m.bName}
        </span>
      </div>

      <div className="min-w-0 text-right max-[780px]:hidden">
        <div className="flex items-center justify-end gap-1.5">
          <span
            className="h-1.5 w-1.5 flex-none rounded-sm"
            style={{ background: region.color }}
          />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-neutral-400">
            {m.event}
          </span>
        </div>
        <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-neutral-600">
          {m.stage}
        </div>
      </div>
    </Link>
  );
}
